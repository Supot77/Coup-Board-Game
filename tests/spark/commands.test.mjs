import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import {
  connectFirestoreEmulator, collection, doc, getDoc, getDocs, getFirestore, setDoc, updateDoc, Timestamp,
} from 'firebase/firestore';
import { createRoom, joinRoom, leaveRoom, kickPlayer, startGame, resetGame, setPlayerReady } from '../../src/core/roomCommands.ts';
import { submitGameCommand, waitForCommandResult } from '../../src/core/gameCommands.ts';
import { processHostCommand } from '../../src/core/hostCommandProcessor.ts';
import { markIdleLobbyForCleanup, ROOM_IDLE_LIMIT_MS } from '../../src/core/roomMaintenance.ts';

const projectId = 'demo-coup';
const clients = new Map();
let host;
let guest;
let outsider;
let roomCode;

async function createClient(label) {
  const app = initializeApp({
    apiKey: 'demo-api-key', authDomain: `${projectId}.firebaseapp.com`, projectId,
    appId: `1:${label}:web:test`,
  }, `spark-${label}-${Date.now()}`);
  const auth = getAuth(app);
  const db = getFirestore(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const { user } = await signInAnonymously(auth);
  const client = { app, auth, db, uid: user.uid };
  clients.set(label, client);
  return client;
}

before(async () => {
  host = await createClient('host');
  guest = await createClient('guest');
  outsider = await createClient('outsider');
});

after(async () => {
  await Promise.all([...clients.values()].map(({ app }) => deleteApp(app)));
});

test('creates a private schema-3 room and joins by known eight-character code', async () => {
  ({ roomCode } = await createRoom('Host', 'male', host.uid, host.db));
  assert.match(roomCode, /^[A-HJ-NP-Z]{8}$/);
  await joinRoom(roomCode, 'Guest', 'female', guest.uid, guest.db);

  const room = (await getDoc(doc(host.db, `rooms/${roomCode}`))).data();
  assert.equal(room.schemaVersion, 3);
  assert.equal(room.deck, undefined);
  assert.equal((await getDocs(collection(host.db, `rooms/${roomCode}/players`))).size, 2);
  assert.equal((await getDoc(doc(host.db, `roomInvites/${roomCode}`))).data().playerCount, 2);
  assert.equal((await getDoc(doc(host.db, `rooms/${roomCode}/players/${host.uid}`))).data().avatarId, 'male');
  assert.equal((await getDoc(doc(host.db, `rooms/${roomCode}/players/${host.uid}`))).data().isReady, false);
  assert.equal((await getDoc(doc(host.db, `rooms/${roomCode}/players/${guest.uid}`))).data().avatarId, 'female');
  assert.equal((await getDoc(doc(host.db, `rooms/${roomCode}/players/${guest.uid}`))).data().isReady, false);
  assert.equal((await getDoc(doc(guest.db, `rooms/${roomCode}/privatePlayers/${guest.uid}`))).exists(), true);
  await assert.rejects(getDoc(doc(outsider.db, `rooms/${roomCode}`)));
  await assert.rejects(getDocs(collection(guest.db, 'roomInvites')));
  await setPlayerReady(roomCode, true, host.uid, host.db);
  await setPlayerReady(roomCode, true, guest.uid, guest.db);
});

test('readiness is self-controlled only in the lobby and ready-only start resets the roster state', async () => {
  const readyRoom = (await createRoom('Ready host', 'male', host.uid, host.db)).roomCode;
  await joinRoom(readyRoom, 'Ready guest', 'female', guest.uid, guest.db);
  await assert.rejects(startGame(readyRoom, host.uid, host.db), /กดพร้อม/);
  await setPlayerReady(readyRoom, true, host.uid, host.db);
  await assert.rejects(startGame(readyRoom, host.uid, host.db), /กดพร้อม/);
  await setPlayerReady(readyRoom, true, guest.uid, guest.db);
  await assert.rejects(setPlayerReady(readyRoom, false, outsider.uid, outsider.db));
  await assert.rejects(startGame(readyRoom, guest.uid, guest.db));
  await startGame(readyRoom, host.uid, host.db);
  for (const player of [host, guest]) {
    const record = (await getDoc(doc(player.db, `rooms/${readyRoom}/players/${player.uid}`))).data();
    assert.equal(record.isReady, false);
    assert.equal(record.avatarId, player === host ? 'male' : 'female');
    await assert.rejects(setPlayerReady(readyRoom, true, player.uid, player.db));
  }
  await resetGame(readyRoom, host.uid, host.db);
  for (const player of [host, guest]) {
    const record = (await getDoc(doc(player.db, `rooms/${readyRoom}/players/${player.uid}`))).data();
    assert.equal(record.isReady, false);
    assert.equal(record.avatarId, player === host ? 'male' : 'female');
  }
});

test('host deals cards, processes an authored action once, and rejects an out-of-turn action', async () => {
  await startGame(roomCode, host.uid, host.db);
  const roomRef = doc(host.db, `rooms/${roomCode}`);
  const room = (await getDoc(roomRef)).data();
  const currentUid = room.turnOrder[room.currentTurnIndex];
  const actor = currentUid === host.uid ? host : guest;

  const hostPrivate = await getDoc(doc(host.db, `rooms/${roomCode}/privatePlayers/${host.uid}`));
  const guestPrivate = await getDoc(doc(guest.db, `rooms/${roomCode}/privatePlayers/${guest.uid}`));
  assert.equal(hostPrivate.data().cards.length, 2);
  assert.equal(guestPrivate.data().cards.length, 2);
  await assert.rejects(getDoc(doc(outsider.db, `rooms/${roomCode}/privatePlayers/${guest.uid}`)));

  const { commandId } = await submitGameCommand(roomCode, actor.uid, { type: 'action', actionName: 'Income' }, actor.db);
  await processHostCommand(roomCode, commandId, host.uid, host.db);
  await processHostCommand(roomCode, commandId, host.uid, host.db);
  const afterIncome = (await getDoc(doc(host.db, `rooms/${roomCode}/players/${actor.uid}`))).data();
  assert.equal(afterIncome.coins, 3);

  const { commandId: rejectedId } = await submitGameCommand(roomCode, actor.uid, { type: 'action', actionName: 'Income' }, actor.db);
  await processHostCommand(roomCode, rejectedId, host.uid, host.db);
  const result = (await getDoc(doc(host.db, `rooms/${roomCode}/commandResults/${rejectedId}`))).data();
  assert.equal(result.actorUid, actor.uid);
  assert.equal(result.ok, false);
  assert.match(result.message, /ตาของคุณ/);

  await assert.rejects(setDoc(doc(guest.db, `rooms/${roomCode}/players/${guest.uid}`), { coins: 999 }));
});

test('a guest waits for delayed command results without a false permission error', async () => {
  const code = (await createRoom('Host', 'male', host.uid, host.db)).roomCode;
  await joinRoom(code, 'Guest', 'female', guest.uid, guest.db);
  await setPlayerReady(code, true, host.uid, host.db);
  await setPlayerReady(code, true, guest.uid, guest.db);
  await startGame(code, host.uid, host.db);
  await updateDoc(doc(host.db, `rooms/${code}`), { turnOrder: [guest.uid, host.uid], currentTurnIndex: 0 });
  for (const ok of [true, false]) {
    const { commandId } = await submitGameCommand(code, guest.uid, { type: 'action', actionName: 'Income' }, guest.db);
    let settled = false;
    const pending = waitForCommandResult(code, commandId, guest.uid, guest.db)
      .then(result => ({ result }), error => ({ error })).finally(() => { settled = true; });
    // A server read forces evaluation while the result is still absent.
    assert.equal((await getDoc(doc(guest.db, `rooms/${code}/commandResults/${commandId}`))).exists(), false);
    assert.equal(settled, false);
    await processHostCommand(code, commandId, host.uid, host.db);
    const outcome = await pending;
    if (ok) assert.equal(outcome.result?.ok, true);
    else { assert.equal(outcome.error?.code, 'failed-precondition'); assert.match(outcome.error.message, /ตาของคุณ/); }
    await processHostCommand(code, commandId, host.uid, host.db);
  }
  assert.equal((await getDoc(doc(guest.db, `rooms/${code}/players/${guest.uid}`))).data().coins, 3);
});

test('the host alone can start, kick, and reset the lobby, and room membership stays bounded', async () => {
  const { roomCode: managementRoom } = await createRoom('Host', 'male', host.uid, host.db);
  await joinRoom(managementRoom, 'Guest', 'female', guest.uid, guest.db);
  await assert.rejects(startGame(managementRoom, guest.uid, guest.db));
  await assert.rejects(resetGame(managementRoom, guest.uid, guest.db));
  await kickPlayer(managementRoom, guest.uid, host.uid, host.db);
  await assert.rejects(getDoc(doc(guest.db, `rooms/${managementRoom}`)));
  assert.equal((await getDoc(doc(host.db, `roomInvites/${managementRoom}`))).data().playerCount, 1);
  await joinRoom(managementRoom, 'Guest', 'female', guest.uid, guest.db);
  assert.equal((await getDoc(doc(host.db, `roomInvites/${managementRoom}`))).data().playerCount, 2);
  const extraPlayers = [];
  for (let index = 0; index < 4; index++) {
    const player = await createClient(`extra-${index}`);
    extraPlayers.push(player);
    await joinRoom(managementRoom, `Extra ${index}`, index % 2 === 0 ? 'male' : 'female', player.uid, player.db);
  }
  await assert.rejects(joinRoom(managementRoom, 'Outsider', 'male', outsider.uid, outsider.db));
  assert.equal((await getDoc(doc(host.db, `roomInvites/${managementRoom}`))).data().playerCount, 6);
  await Promise.all([host, guest, ...extraPlayers].map(player => setPlayerReady(managementRoom, true, player.uid, player.db)));
  await startGame(managementRoom, host.uid, host.db);
  await assert.rejects(kickPlayer(managementRoom, extraPlayers[0].uid, guest.uid, guest.db));
  await resetGame(managementRoom, host.uid, host.db);
  const invite = (await getDoc(doc(host.db, `roomInvites/${managementRoom}`))).data();
  assert.equal(invite.status, 'lobby');
  assert.equal(invite.playerCount, 6);
});

test('members can leave safely and an inactive lobby is closed after 30 minutes', async () => {
  const { roomCode: leavingRoom } = await createRoom('Host', 'male', host.uid, host.db);
  await joinRoom(leavingRoom, 'Guest', 'female', guest.uid, guest.db);
  await leaveRoom(leavingRoom, guest.uid, guest.db);
  const roomAfterGuestLeaves = (await getDoc(doc(host.db, `rooms/${leavingRoom}`))).data();
  assert.equal(roomAfterGuestLeaves.adminId, host.uid);
  assert.equal((await getDoc(doc(host.db, `roomInvites/${leavingRoom}`))).data().playerCount, 1);
  await leaveRoom(leavingRoom, host.uid, host.db);
  assert.equal((await getDoc(doc(host.db, `roomInvites/${leavingRoom}`))).exists(), false);

  const { roomCode: idleRoom } = await createRoom('Idle', 'male', host.uid, host.db);
  assert.equal(await markIdleLobbyForCleanup(idleRoom, host.uid, Date.now(), host.db), false);
  await updateDoc(doc(host.db, `rooms/${idleRoom}`), {
    lastActivityAt: Timestamp.fromMillis(Date.now() - ROOM_IDLE_LIMIT_MS),
  });
  assert.equal(await markIdleLobbyForCleanup(idleRoom, host.uid, Date.now(), host.db), true);
  assert.equal((await getDoc(doc(host.db, `roomInvites/${idleRoom}`))).exists(), false);
});

test('a concurrent join cannot sneak an unready player into a started game', async () => {
  const concurrentRoom = (await createRoom('Host', 'male', host.uid, host.db)).roomCode;
  await joinRoom(concurrentRoom, 'Guest', 'female', guest.uid, guest.db);
  await setPlayerReady(concurrentRoom, true, host.uid, host.db);
  await setPlayerReady(concurrentRoom, true, guest.uid, guest.db);
  const newcomer = await createClient('concurrent-newcomer');

  const [startResult, joinResult] = await Promise.allSettled([
    startGame(concurrentRoom, host.uid, host.db),
    joinRoom(concurrentRoom, 'Newcomer', 'male', newcomer.uid, newcomer.db),
  ]);
  const room = (await getDoc(doc(host.db, `rooms/${concurrentRoom}`))).data();
  const invite = (await getDoc(doc(host.db, `roomInvites/${concurrentRoom}`))).data();
  const roster = await getDocs(collection(host.db, `rooms/${concurrentRoom}/players`));

  if (room.status === 'playing') {
    assert.equal(roster.size, 2);
    assert.equal(invite.playerCount, 2);
    assert.equal(joinResult.status, 'rejected');
  } else {
    assert.equal(room.status, 'lobby');
    assert.equal(roster.size, 3);
    assert.equal(invite.playerCount, 3);
    assert.equal(startResult.status, 'rejected');
    assert.match(startResult.reason.message, /รายชื่อผู้เล่น|กดพร้อม/);
    assert.equal((await getDoc(doc(host.db, `rooms/${concurrentRoom}/players/${newcomer.uid}`))).data().isReady, false);
  }
});
