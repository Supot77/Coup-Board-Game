import {
  collection, doc, getDocs, onSnapshot, orderBy, query, runTransaction, serverTimestamp, updateDoc,
  type Firestore,
} from 'firebase/firestore';
import { db } from './firebase.ts';
import { applyGameCommand, GameRuleError, type Aggregate, type PrivatePlayer, type PublicPlayer, type Room, type Role } from './gameEngine.ts';
import { buildPublicGameEvent } from './gameEvents.ts';
import { responseDeadlineMillis } from './responseTiming.ts';
import { submitGameCommand } from './gameCommands.ts';

function ruleMessage(error: unknown) {
  if (error instanceof GameRuleError) return error.message;
  return 'รูปแบบคำสั่งไม่ถูกต้องหรือเกมเปลี่ยนสถานะแล้ว';
}

export async function processHostCommand(
  roomCode: string,
  commandId: string,
  hostUid: string,
  database: Firestore = db,
) {
  const roomRef = doc(database, `rooms/${roomCode}`);
  const commandRef = doc(database, `rooms/${roomCode}/commands/${commandId}`);
  const resultRef = doc(database, `rooms/${roomCode}/commandResults/${commandId}`);
  const rosterRef = collection(database, `rooms/${roomCode}/players`);
  const internalRef = doc(database, `rooms/${roomCode}/internal/state`);
  const rosterSnap = await getDocs(rosterRef);

  await runTransaction(database, async transaction => {
    const [roomSnap, commandSnap, resultSnap, internalSnap] = await Promise.all([
      transaction.get(roomRef), transaction.get(commandRef), transaction.get(resultRef),
      transaction.get(internalRef),
    ]);
    if (resultSnap.exists() || !commandSnap.exists()) return;
    if (!roomSnap.exists()) return;
    const room = roomSnap.data() as Room;
    if (room.schemaVersion !== 3 || room.adminId !== hostUid || room.status !== 'playing') return;

    const uids = rosterSnap.docs.map(player => player.id);
    const playerSnaps = await Promise.all(rosterSnap.docs.map(player => transaction.get(player.ref)));
    const privateRefs = uids.map(uid => doc(database, `rooms/${roomCode}/privatePlayers/${uid}`));
    const privateSnaps = await Promise.all(privateRefs.map(reference => transaction.get(reference)));
    const actorUid = commandSnap.data().actorUid as string;
    if (!uids.includes(actorUid) || playerSnaps.some(snapshot => !snapshot.exists())
      || privateSnaps.some(snapshot => !snapshot.exists()) || !internalSnap.exists()) {
      transaction.set(resultRef, {
        actorUid, ok: false, message: 'ผู้เล่นหรือข้อมูลเกมในห้องนี้ไม่มีแล้ว', completedAt: serverTimestamp(),
      });
      transaction.delete(commandRef);
      return;
    }

    const players: Record<string, PublicPlayer> = {};
    const privatePlayers: Record<string, PrivatePlayer> = {};
    rosterSnap.docs.forEach((snapshot, index) => {
      players[snapshot.id] = playerSnaps[index].data() as PublicPlayer;
      privatePlayers[snapshot.id] = privateSnaps[index].data() as PrivatePlayer;
    });
    const aggregate: Aggregate = {
      room,
      players,
      privatePlayers,
      deck: (internalSnap.data().deck ?? []) as Role[],
      now: Date.now(),
    };
    const before = { room: { ...room }, players: structuredClone(players) };

    try {
      if (!aggregate.room.roundId) {
        aggregate.room.roundId = `legacy-${aggregate.room.gameStartedAt ?? Date.now()}`;
        aggregate.room.historyStartedMidRound = true;
      }
      applyGameCommand(aggregate, actorUid, commandSnap.data().payload);
      const event = buildPublicGameEvent(before, aggregate, actorUid, commandSnap.data().payload);
      aggregate.room.eventSequence = event.sequence;
      if (aggregate.room.responseWindowId && aggregate.room.responseWindowId !== before.room.responseWindowId) {
        aggregate.room.responseStartedAt = serverTimestamp();
      }
      aggregate.room.deckCount = aggregate.deck.length;
      aggregate.room.lastActivityAt = serverTimestamp();
      aggregate.room.hostSeenAt = serverTimestamp();
      transaction.set(roomRef, aggregate.room);
      transaction.set(doc(database, `rooms/${roomCode}/events/${commandId}`), { ...event, at: serverTimestamp() });
      transaction.set(internalRef, { deck: aggregate.deck }, { merge: true });
      for (const [index, uid] of uids.entries()) {
        transaction.set(playerSnaps[index].ref, aggregate.players[uid]);
        transaction.set(privateRefs[index], aggregate.privatePlayers[uid]);
      }
      transaction.set(resultRef, {
        actorUid, ok: true, message: 'คำสั่งสำเร็จ', completedAt: serverTimestamp(),
      });
    } catch (error) {
      transaction.set(resultRef, {
        actorUid, ok: false, message: ruleMessage(error), completedAt: serverTimestamp(),
      });
    }
    transaction.delete(commandRef);
  });
}

export function watchHostCommands(
  roomCode: string,
  hostUid: string,
  onError: (error: unknown) => void,
  database: Firestore = db,
) {
  const commandsRef = collection(database, `rooms/${roomCode}/commands`);
  const commandsQuery = query(commandsRef, orderBy('createdAt', 'asc'));
  const running = new Set<string>();
  let active = true;
  let latestRoom: Room | null = null;
  let expiringWindow: string | null = null;
  let maintaining = false;
  const reportError = (error: unknown) => { if (active) onError(error); };
  const unsubscribe = onSnapshot(commandsQuery, snapshot => {
    if (!active) return;
    for (const command of snapshot.docs) {
      if (running.has(command.id)) continue;
      running.add(command.id);
      void processHostCommand(roomCode, command.id, hostUid, database)
        .catch(reportError)
        .finally(() => running.delete(command.id));
    }
  }, reportError);
  const roomRef = doc(database, `rooms/${roomCode}`);
  const maintain = async () => {
    if (!active || maintaining || !latestRoom || latestRoom.status !== 'playing' || latestRoom.gameState === 'game_over'
      || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
    maintaining = true;
    try {
      const responding = ['waiting_for_responses', 'waiting_for_block_responses'].includes(latestRoom.gameState);
      if (responding && (!latestRoom.responseWindowId || responseDeadlineMillis(latestRoom) === null)) {
        // Upgrade an existing in-flight room once; a reload never renews a stamped window.
        await runTransaction(database, async transaction => {
          const snapshot = await transaction.get(roomRef);
          if (!snapshot.exists()) return;
          const current = snapshot.data();
          if (current.adminId !== hostUid || current.status !== 'playing'
            || !['waiting_for_responses', 'waiting_for_block_responses'].includes(current.gameState)
            || (current.responseWindowId && responseDeadlineMillis(current) !== null)) return;
          const sequence = (current.responseSequence ?? 0) + 1;
          transaction.update(roomRef, { responseSequence: sequence, responseWindowId: `${current.roundId ?? 'legacy'}:${sequence}`, responseStartedAt: serverTimestamp() });
        });
      } else if (responding) {
        const deadline = responseDeadlineMillis(latestRoom);
        if (deadline !== null && Date.now() >= deadline && expiringWindow !== latestRoom.responseWindowId) {
          const windowId = latestRoom.responseWindowId as string;
          expiringWindow = windowId;
          try { await submitGameCommand(roomCode, hostUid, { type: 'expireResponses', responseWindowId: windowId }, database); }
          catch (error) { expiringWindow = null; throw error; }
        }
      }
    } catch (error) { reportError(error); }
    finally { maintaining = false; }
  };
  const unsubscribeRoom = onSnapshot(roomRef, { includeMetadataChanges: true }, snapshot => {
    if (!active || snapshot.metadata.hasPendingWrites || snapshot.metadata.fromCache) return;
    latestRoom = snapshot.exists() ? snapshot.data() as Room : null;
    void maintain();
  }, reportError);
  const expiryTimer = setInterval(() => { void maintain(); }, 1000);
  const heartbeat = setInterval(() => {
    if (active && latestRoom?.status === 'playing' && latestRoom.gameState !== 'game_over'
      && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
      void updateDoc(roomRef, { hostSeenAt: serverTimestamp() }).catch(reportError);
    }
  }, 20_000);
  return () => { active = false; unsubscribe(); unsubscribeRoom(); clearInterval(expiryTimer); clearInterval(heartbeat); };
}
