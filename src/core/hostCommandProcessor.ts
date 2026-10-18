import {
  collection, doc, getDocs, onSnapshot, orderBy, query, runTransaction, serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import { db } from './firebase.ts';
import { applyGameCommand, GameRuleError, type Aggregate, type PrivatePlayer, type PublicPlayer, type Room, type Role } from './gameEngine.ts';

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

    try {
      applyGameCommand(aggregate, actorUid, commandSnap.data().payload);
      aggregate.room.deckCount = aggregate.deck.length;
      aggregate.room.lastActivityAt = serverTimestamp();
      transaction.set(roomRef, aggregate.room);
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
  return () => { active = false; unsubscribe(); };
}
