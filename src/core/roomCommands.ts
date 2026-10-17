import {
  collection, doc, getDocs, runTransaction, serverTimestamp, Timestamp,
  type Firestore,
} from 'firebase/firestore';
import { auth, db } from './firebase.ts';
import { createInitialDeck, type Card, type PrivatePlayer, type PublicPlayer, type Role, type Room } from './gameEngine.ts';
import { finishLobbyCleanup } from './roomMaintenance.ts';

const ROOM_IDLE_MS = 30 * 60 * 1000;
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z]{8}$/;

function currentUid(uid?: string) {
  const value = uid ?? auth.currentUser?.uid;
  if (!value) throw Object.assign(new Error('กรุณาเข้าสู่ระบบก่อน'), { code: 'unauthenticated' });
  return value;
}

function fail(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}

function normalizeName(value: string) {
  const name = value.trim().replace(/\s+/g, ' ').slice(0, 24);
  if (!name) fail('invalid-argument', 'กรุณากรอกชื่อผู้เล่น');
  return name;
}

export function normalizeRoomCode(value: string) {
  const code = value.trim().toUpperCase();
  if (!ROOM_CODE_PATTERN.test(code)) fail('invalid-argument', 'รหัสห้องต้องมี 8 ตัวอักษร A–H, J–N หรือ P–Z');
  return code;
}

function randomRoomCode() {
  const random = new Uint8Array(8);
  globalThis.crypto.getRandomValues(random);
  return [...random].map(byte => ROOM_CODE_CHARS[Math.floor(byte * ROOM_CODE_CHARS.length / 256)]).join('');
}

function makePlayer(name: string): PublicPlayer {
  return { name, coins: 2, isDead: false, influenceCount: 2, revealedCards: [] };
}

function newCard(character: Role, id: string): Card {
  return { character, isDead: false, id };
}

function idleExpiry(now: number) { return Timestamp.fromMillis(now + ROOM_IDLE_MS); }

export async function createRoom(displayName: string, uid = currentUid(), database: Firestore = db) {
  const actor = currentUid(uid);
  const name = normalizeName(displayName);
  for (let attempt = 0; attempt < 12; attempt++) {
    const roomCode = randomRoomCode();
    const roomRef = doc(database, `rooms/${roomCode}`);
    const inviteRef = doc(database, `roomInvites/${roomCode}`);
    const playerRef = doc(database, `rooms/${roomCode}/players/${actor}`);
    const privateRef = doc(database, `rooms/${roomCode}/privatePlayers/${actor}`);
    const internalRef = doc(database, `rooms/${roomCode}/internal/state`);
    const now = Date.now();
    try {
      await runTransaction(database, async transaction => {
        const inviteSnap = await transaction.get(inviteRef);
        if (inviteSnap.exists()) fail('already-exists', 'ลองสร้างห้องใหม่อีกครั้ง');
        const room: Room = {
          schemaVersion: 3, status: 'lobby', gameState: 'lobby', adminId: actor,
          cleanupStarted: false,
          deckCount: 0, createdAt: serverTimestamp(), lastActivityAt: serverTimestamp(),
          expiresAt: idleExpiry(now), turnOrder: [], currentTurnIndex: 0,
          pendingAction: null, passVotes: [], actionLog: 'รอผู้เล่นเข้าห้อง',
        };
        transaction.set(roomRef, room);
        transaction.set(inviteRef, { schemaVersion: 3, status: 'lobby', playerCount: 1 });
        transaction.set(playerRef, makePlayer(name));
        transaction.set(privateRef, { cards: [], exchangeOptions: [] } satisfies PrivatePlayer);
        transaction.set(internalRef, { deck: [] });
      });
      return { roomCode };
    } catch (error) {
      if ((error as { code?: string }).code === 'already-exists') continue;
      throw error;
    }
  }
  fail('resource-exhausted', 'สร้างรหัสห้องไม่สำเร็จ กรุณาลองใหม่');
}

export async function joinRoom(codeInput: string, displayName: string, uid = currentUid(), database: Firestore = db) {
  const actor = currentUid(uid);
  const roomCode = normalizeRoomCode(codeInput);
  const name = normalizeName(displayName);
  const inviteRef = doc(database, `roomInvites/${roomCode}`);
  const playerRef = doc(database, `rooms/${roomCode}/players/${actor}`);
  const privateRef = doc(database, `rooms/${roomCode}/privatePlayers/${actor}`);
  await runTransaction(database, async transaction => {
    const [inviteSnap, playerSnap, privateSnap] = await Promise.all([
      transaction.get(inviteRef), transaction.get(playerRef), transaction.get(privateRef),
    ]);
    if (!inviteSnap.exists()) fail('not-found', 'ไม่พบห้องนี้');
    const invite = inviteSnap.data();
    if (invite.schemaVersion !== 3 || invite.status !== 'lobby') fail('failed-precondition', 'ห้องนี้ไม่ได้เปิดรับผู้เล่นแล้ว');
    if (playerSnap.exists()) return;
    if (invite.playerCount >= 6) fail('resource-exhausted', 'ห้องเต็มแล้ว (สูงสุด 6 คน)');
    if (privateSnap.exists()) fail('failed-precondition', 'ข้อมูลผู้เล่นในห้องไม่สมบูรณ์');
    transaction.update(inviteRef, { playerCount: invite.playerCount + 1 });
    transaction.set(playerRef, makePlayer(name));
    transaction.set(privateRef, { cards: [], exchangeOptions: [] } satisfies PrivatePlayer);
    transaction.update(doc(database, `rooms/${roomCode}`), {
      lastActivityAt: serverTimestamp(), expiresAt: idleExpiry(Date.now()),
    });
  });
  return { roomCode };
}

export async function leaveRoom(codeInput: string, uid = currentUid(), database: Firestore = db) {
  const actor = currentUid(uid);
  const roomCode = normalizeRoomCode(codeInput);
  const roomRef = doc(database, `rooms/${roomCode}`);
  const inviteRef = doc(database, `roomInvites/${roomCode}`);
  const playerRef = doc(database, `rooms/${roomCode}/players/${actor}`);
  const privateRef = doc(database, `rooms/${roomCode}/privatePlayers/${actor}`);
  const rosterSnap = await getDocs(collection(database, `rooms/${roomCode}/players`));
  let closeAndDelete = false;
  await runTransaction(database, async transaction => {
    const [roomSnap, inviteSnap, playerSnap, privateSnap] = await Promise.all([
      transaction.get(roomRef), transaction.get(inviteRef), transaction.get(playerRef), transaction.get(privateRef),
    ]);
    if (!roomSnap.exists() || !inviteSnap.exists() || !playerSnap.exists()) fail('not-found', 'ไม่พบห้องหรือคุณไม่ได้อยู่ในห้องนี้');
    const room = roomSnap.data() as Room;
    const invite = inviteSnap.data();
    if (rosterSnap.size !== invite.playerCount || !rosterSnap.docs.some(item => item.id === actor)) {
      fail('aborted', 'รายชื่อผู้เล่นเปลี่ยนแล้ว กรุณาลองออกจากห้องอีกครั้ง');
    }
    if (room.schemaVersion !== 3 || room.status !== 'lobby' || room.cleanupStarted === true) {
      fail('failed-precondition', 'ออกจากห้องได้หลังเกมจบหรือขณะอยู่ในล็อบบี้');
    }
    if (rosterSnap.size <= 1) {
      closeAndDelete = true;
      transaction.update(roomRef, { cleanupStarted: true });
      transaction.update(inviteRef, { status: 'closed', playerCount: 0 });
      transaction.set(doc(database, `rooms/${roomCode}/cleanupMarkers/${actor}`), { createdAt: serverTimestamp() });
      return;
    }
    const remaining = rosterSnap.docs.map(item => item.id).filter(id => id !== actor);
    const nextAdmin = room.adminId === actor ? remaining[0] : room.adminId;
    transaction.delete(playerRef);
    if (privateSnap.exists()) transaction.delete(privateRef);
    transaction.update(inviteRef, { playerCount: invite.playerCount - 1 });
    transaction.update(roomRef, {
      adminId: nextAdmin, lastActivityAt: serverTimestamp(), expiresAt: idleExpiry(Date.now()),
    });
  });
  if (closeAndDelete) await finishLobbyCleanup(roomCode, actor, database);
}

export async function kickPlayer(codeInput: string, targetUid: string, uid = currentUid(), database: Firestore = db) {
  const actor = currentUid(uid);
  const roomCode = normalizeRoomCode(codeInput);
  if (!targetUid || targetUid === actor) fail('invalid-argument', 'เลือกผู้เล่นคนอื่นในห้อง');
  const roomRef = doc(database, `rooms/${roomCode}`);
  const inviteRef = doc(database, `roomInvites/${roomCode}`);
  const targetRef = doc(database, `rooms/${roomCode}/players/${targetUid}`);
  const targetPrivateRef = doc(database, `rooms/${roomCode}/privatePlayers/${targetUid}`);
  await runTransaction(database, async transaction => {
    const [roomSnap, inviteSnap, targetSnap, privateSnap] = await Promise.all([
      transaction.get(roomRef), transaction.get(inviteRef), transaction.get(targetRef), transaction.get(targetPrivateRef),
    ]);
    if (!roomSnap.exists() || !inviteSnap.exists() || !targetSnap.exists()) fail('not-found', 'ไม่พบผู้เล่นในห้อง');
    const room = roomSnap.data() as Room;
    if (room.schemaVersion !== 3 || room.status !== 'lobby' || room.adminId !== actor || room.cleanupStarted === true) {
      fail('permission-denied', 'เฉพาะเจ้าของห้องในล็อบบี้เท่านั้นที่นำผู้เล่นออกได้');
    }
    const invite = inviteSnap.data();
    transaction.delete(targetRef);
    if (privateSnap.exists()) transaction.delete(targetPrivateRef);
    transaction.update(inviteRef, { playerCount: invite.playerCount - 1 });
    transaction.update(roomRef, { lastActivityAt: serverTimestamp(), expiresAt: idleExpiry(Date.now()) });
  });
}

export async function startGame(codeInput: string, uid = currentUid(), database: Firestore = db) {
  const actor = currentUid(uid);
  const roomCode = normalizeRoomCode(codeInput);
  const roomRef = doc(database, `rooms/${roomCode}`);
  const inviteRef = doc(database, `roomInvites/${roomCode}`);
  const rosterRef = collection(database, `rooms/${roomCode}/players`);
  const internalRef = doc(database, `rooms/${roomCode}/internal/state`);
  const rosterSnap = await getDocs(rosterRef);
  await runTransaction(database, async transaction => {
    const [roomSnap, inviteSnap, internalSnap] = await Promise.all([
      transaction.get(roomRef), transaction.get(inviteRef), transaction.get(internalRef),
    ]);
    if (!roomSnap.exists() || !inviteSnap.exists()) fail('not-found', 'ไม่พบห้องนี้');
    const room = roomSnap.data() as Room;
    if (room.schemaVersion !== 3 || room.status !== 'lobby' || room.adminId !== actor || room.cleanupStarted === true) {
      fail('permission-denied', 'เฉพาะเจ้าของห้องเท่านั้นที่เริ่มเกมได้');
    }
    const ids = rosterSnap.docs.map(item => item.id);
    if (ids.length !== inviteSnap.data().playerCount) fail('aborted', 'รายชื่อผู้เล่นกำลังเปลี่ยน กรุณากดเริ่มเกมอีกครั้ง');
    if (ids.length < 2 || ids.length > 6) fail('failed-precondition', 'เกมต้องมีผู้เล่น 2 ถึง 6 คน');
    const playerSnaps = await Promise.all(rosterSnap.docs.map(player => transaction.get(player.ref)));
    if (playerSnaps.some(snapshot => !snapshot.exists())) fail('aborted', 'รายชื่อผู้เล่นกำลังเปลี่ยน กรุณากดเริ่มเกมอีกครั้ง');
    const privateRefs = ids.map(id => doc(database, `rooms/${roomCode}/privatePlayers/${id}`));
    const privateSnaps = await Promise.all(privateRefs.map(reference => transaction.get(reference)));
    if (privateSnaps.some(snapshot => !snapshot.exists())) fail('failed-precondition', 'ข้อมูลไพ่ผู้เล่นไม่ครบ กรุณาออกแล้วเข้าห้องใหม่');
    const deck = createInitialDeck();
    ids.forEach((id, index) => {
      const player = playerSnaps[index].data() as PublicPlayer;
      const cards = [newCard(deck.pop()!, `${Date.now()}-${id}-0`), newCard(deck.pop()!, `${Date.now()}-${id}-1`)];
      transaction.set(playerSnaps[index].ref, { ...player, coins: 2, isDead: false, influenceCount: 2, revealedCards: [] });
      transaction.set(privateRefs[index], { cards, exchangeOptions: [] } satisfies PrivatePlayer);
    });
    const turnOrder = [...ids].sort(() => Math.random() - 0.5);
    transaction.set(internalRef, { deck }, { merge: true });
    transaction.update(roomRef, {
      status: 'playing', gameState: 'waiting_for_action', deckCount: deck.length,
      turnOrder, currentTurnIndex: 0, passVotes: [], pendingAction: null,
      discardTarget: null, afterDiscardState: null, afterDiscardPayload: null,
      gameStartedAt: Date.now(), lastActivityAt: serverTimestamp(), actionLog: 'เกมเริ่มแล้ว ผู้เล่นที่ถึงตาเลือกแอคชั่นได้',
    });
    transaction.update(inviteRef, { status: 'playing' });
    if (!internalSnap.exists()) fail('failed-precondition', 'ไม่พบข้อมูลกองไพ่ของห้อง');
  });
}

export async function resetGame(codeInput: string, uid = currentUid(), database: Firestore = db) {
  const actor = currentUid(uid);
  const roomCode = normalizeRoomCode(codeInput);
  const roomRef = doc(database, `rooms/${roomCode}`);
  const inviteRef = doc(database, `roomInvites/${roomCode}`);
  const internalRef = doc(database, `rooms/${roomCode}/internal/state`);
  const rosterRef = collection(database, `rooms/${roomCode}/players`);
  const rosterSnap = await getDocs(rosterRef);
  await runTransaction(database, async transaction => {
    const [roomSnap, inviteSnap, internalSnap] = await Promise.all([
      transaction.get(roomRef), transaction.get(inviteRef), transaction.get(internalRef),
    ]);
    if (!roomSnap.exists() || !inviteSnap.exists()) fail('not-found', 'ไม่พบห้องนี้');
    const room = roomSnap.data() as Room;
    if (room.adminId !== actor || room.schemaVersion !== 3 || room.cleanupStarted === true) {
      fail('permission-denied', 'เฉพาะเจ้าของห้องเท่านั้นที่กลับล็อบบี้ได้');
    }
    if (rosterSnap.size !== inviteSnap.data().playerCount) fail('aborted', 'รายชื่อผู้เล่นกำลังเปลี่ยน กรุณาลองใหม่');
    const playerSnaps = await Promise.all(rosterSnap.docs.map(player => transaction.get(player.ref)));
    const privateRefs = rosterSnap.docs.map(item => doc(database, `rooms/${roomCode}/privatePlayers/${item.id}`));
    const privateSnaps = await Promise.all(privateRefs.map(reference => transaction.get(reference)));
    const now = Date.now();
    for (let index = 0; index < rosterSnap.docs.length; index++) {
      transaction.set(playerSnaps[index].ref, makePlayer((playerSnaps[index].data() as PublicPlayer).name));
      transaction.set(privateRefs[index], { cards: [], exchangeOptions: [] } satisfies PrivatePlayer);
    }
    transaction.set(internalRef, { deck: [] }, { merge: true });
    transaction.update(roomRef, {
      status: 'lobby', gameState: 'lobby', turnOrder: [], currentTurnIndex: 0,
      pendingAction: null, passVotes: [], discardTarget: null, afterDiscardState: null,
      afterDiscardPayload: null, ignoreBlock: false, gameStartedAt: null, winner: null,
      deckCount: 0, actionLog: 'รอเริ่มเกมใหม่', cleanupStarted: false,
      lastActivityAt: serverTimestamp(), expiresAt: idleExpiry(now),
    });
    transaction.update(inviteRef, { status: 'lobby' });
    if (!internalSnap.exists() || privateSnaps.some(snapshot => !snapshot.exists())) {
      fail('failed-precondition', 'ข้อมูลห้องไม่ครบ กรุณาสร้างห้องใหม่');
    }
  });
}

export function getCallableMessage(error: unknown) {
  const details = error as { code?: string; message?: string };
  const code = details?.code?.replace(/^functions\//, '');
  if (code === 'unauthenticated') return 'เซสชันหมดเวลาแล้ว กรุณาเข้าสู่ระบบใหม่';
  if (code === 'not-found') return 'ไม่พบห้องนี้หรือห้องหมดเวลาแล้ว';
  if (code === 'permission-denied') return 'คุณไม่มีสิทธิ์ทำรายการนี้';
  if (code === 'resource-exhausted') return details.message || 'ห้องเต็มแล้ว';
  if (code === 'failed-precondition' || code === 'invalid-argument' || code === 'already-exists') return details.message || 'ข้อมูลไม่ถูกต้องหรือสถานะเกมเปลี่ยนแล้ว';
  if (code === 'unavailable' || code === 'deadline-exceeded') return 'เชื่อมต่อ Firestore ไม่สำเร็จ กรุณาลองอีกครั้ง';
  return details?.message || 'ทำรายการไม่สำเร็จ กรุณาลองใหม่';
}
