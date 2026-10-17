import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import {
  connectFirestoreEmulator, collection, doc, getDoc, getDocs, getFirestore, setDoc, updateDoc, Timestamp,
} from 'firebase/firestore';
import { createRoom, joinRoom, leaveRoom, kickPlayer, startGame, resetGame } from '../../src/core/roomCommands.ts';
import { submitGameCommand } from '../../src/core/gameCommands.ts';
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
  ({ roomCode } = await createRoom('Host', host.uid, host.db));
  assert.match(roomCode, /^[A-HJ-NP-Z]{8}$/);
  await joinRoom(roomCode, 'Guest', guest.uid, guest.db);

  const room = (await getDoc(doc(host.db, `rooms/${roomCode}`))).data();
  assert.equal(room.schemaVersion, 3);
  assert.equal(room.deck, undefined);
  assert.equal((await getDocs(collection(host.db, `rooms/${roomCode}/players`))).size, 2);
  assert.equal((await getDoc(doc(guest.db, `rooms/${roomCode}/privatePlayers/${guest.uid}`))).exists(), true);
  await assert.rejects(getDoc(doc(outsider.db, `rooms/${roomCode}`)));
  await assert.rejects(getDocs(collection(guest.db, 'roomInvites')));
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

test('the host alone can start, kick, and reset the lobby, and room membership stays bounded', async () => {
  const { roomCode: managementRoom } = await createRoom('Host', host.uid, host.db);
  await joinRoom(managementRoom, 'Guest', guest.uid, guest.db);
  await assert.rejects(startGame(managementRoom, guest.uid, guest.db));
  await assert.rejects(resetGame(managementRoom, guest.uid, guest.db));
  await kickPlayer(managementRoom, guest.uid, host.uid, host.db);
  await assert.rejects(getDoc(doc(guest.db, `rooms/${managementRoom}`)));
  await joinRoom(managementRoom, 'Guest', guest.uid, guest.db);
  const extraPlayers = [];
  for (let index = 0; index < 4; index++) {
    const player = await createClient(`extra-${index}`);
    extraPlayers.push(player);
    await joinRoom(managementRoom, `Extra ${index}`, player.uid, player.db);
  }
  await assert.rejects(joinRoom(managementRoom, 'Outsider', outsider.uid, outsider.db));
  await startGame(managementRoom, host.uid, host.db);
  await assert.rejects(kickPlayer(managementRoom, extraPlayers[0].uid, guest.uid, guest.db));
  await resetGame(managementRoom, host.uid, host.db);
  const invite = (await getDoc(doc(host.db, `roomInvites/${managementRoom}`))).data();
  assert.equal(invite.status, 'lobby');
});

test('members can leave safely and an inactive lobby is closed after 30 minutes', async () => {
  const { roomCode: leavingRoom } = await createRoom('Host', host.uid, host.db);
  await joinRoom(leavingRoom, 'Guest', guest.uid, guest.db);
  await leaveRoom(leavingRoom, guest.uid, guest.db);
  const roomAfterGuestLeaves = (await getDoc(doc(host.db, `rooms/${leavingRoom}`))).data();
  assert.equal(roomAfterGuestLeaves.adminId, host.uid);
  assert.equal((await getDoc(doc(host.db, `roomInvites/${leavingRoom}`))).data().playerCount, 1);
  await leaveRoom(leavingRoom, host.uid, host.db);
  assert.equal((await getDoc(doc(host.db, `roomInvites/${leavingRoom}`))).exists(), false);

  const { roomCode: idleRoom } = await createRoom('Idle', host.uid, host.db);
  assert.equal(await markIdleLobbyForCleanup(idleRoom, host.uid, Date.now(), host.db), false);
  await updateDoc(doc(host.db, `rooms/${idleRoom}`), {
    lastActivityAt: Timestamp.fromMillis(Date.now() - ROOM_IDLE_LIMIT_MS),
  });
  assert.equal(await markIdleLobbyForCleanup(idleRoom, host.uid, Date.now(), host.db), true);
  assert.equal((await getDoc(doc(host.db, `roomInvites/${idleRoom}`))).exists(), false);
});
