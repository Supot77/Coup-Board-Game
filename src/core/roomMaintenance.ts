import {
  collection, doc, getDoc, getDocs, limit, query, runTransaction, serverTimestamp, Timestamp, writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { auth, db } from './firebase.ts';

export const ROOM_IDLE_LIMIT_MS = 30 * 60 * 1000;
const DELETE_BATCH_LIMIT = 400;

function requireUid(uid?: string) {
  const value = uid ?? auth.currentUser?.uid;
  if (!value) throw Object.assign(new Error('กรุณาเข้าสู่ระบบก่อน'), { code: 'unauthenticated' });
  return value;
}

function millis(value: unknown) {
  if (value instanceof Timestamp) return value.toMillis();
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export async function markIdleLobbyForCleanup(
  roomCode: string,
  uid?: string,
  now = Date.now(),
  database: Firestore = db,
) {
  const actor = requireUid(uid);
  const roomRef = doc(database, `rooms/${roomCode}`);
  const inviteRef = doc(database, `roomInvites/${roomCode}`);
  const playerRef = doc(database, `rooms/${roomCode}/players/${actor}`);
  const markerRef = doc(database, `rooms/${roomCode}/cleanupMarkers/${actor}`);
  const shouldFinish = await runTransaction(database, async transaction => {
    const [roomSnap, playerSnap, markerSnap] = await Promise.all([
      transaction.get(roomRef), transaction.get(playerRef), transaction.get(markerRef),
    ]);
    if (!roomSnap.exists() || !playerSnap.exists()) return false;
    const room = roomSnap.data();
    if (room.schemaVersion !== 3 || room.status !== 'lobby') return false;
    const stale = now - millis(room.lastActivityAt) >= ROOM_IDLE_LIMIT_MS;
    if (!stale && room.cleanupStarted !== true) return false;
    if (room.cleanupStarted !== true) {
      transaction.update(roomRef, { cleanupStarted: true });
      transaction.update(inviteRef, { status: 'closed' });
    }
    if (!markerSnap.exists()) transaction.set(markerRef, { createdAt: serverTimestamp() });
    return true;
  });
  if (shouldFinish) await finishLobbyCleanup(roomCode, actor, database);
  return shouldFinish;
}

async function deletePages(database: Firestore, path: string, exceptId?: string) {
  while (true) {
    const snapshot = await getDocs(query(collection(database, path), limit(DELETE_BATCH_LIMIT + 1)));
    const deletable = snapshot.docs.filter(item => item.id !== exceptId).slice(0, DELETE_BATCH_LIMIT);
    if (!deletable.length) return;
    const batch = writeBatch(database);
    for (const item of deletable) batch.delete(item.ref);
    await batch.commit();
  }
}

export async function finishLobbyCleanup(roomCode: string, uid?: string, database: Firestore = db) {
  const actor = requireUid(uid);
  const roomRef = doc(database, `rooms/${roomCode}`);
  const playerRef = doc(database, `rooms/${roomCode}/players/${actor}`);
  const markerRef = doc(database, `rooms/${roomCode}/cleanupMarkers/${actor}`);
  const [roomSnap, playerSnap, markerSnap] = await Promise.all([
    getDoc(roomRef), getDoc(playerRef), getDoc(markerRef),
  ]);
  if (!roomSnap.exists()) return;
  if (roomSnap.data().status !== 'lobby' || !roomSnap.data().cleanupStarted) return;
  if (!playerSnap.exists() && !markerSnap.exists()) return;

  await deletePages(database, `rooms/${roomCode}/players`);
  await deletePages(database, `rooms/${roomCode}/privatePlayers`);
  await deletePages(database, `rooms/${roomCode}/commands`);
  await deletePages(database, `rooms/${roomCode}/commandResults`);
  await deletePages(database, `rooms/${roomCode}/internal`);
  await deletePages(database, `rooms/${roomCode}/cleanupMarkers`, actor);

  const batch = writeBatch(database);
  batch.delete(doc(database, `roomInvites/${roomCode}`));
  batch.delete(markerRef);
  batch.delete(roomRef);
  await batch.commit();
}

export function watchLobbyMaintenance(roomCode: string, uid: string, database: Firestore = db) {
  let stopped = false;
  let running = false;
  const run = async () => {
    if (stopped || running || document.visibilityState === 'hidden') return;
    running = true;
    try { await markIdleLobbyForCleanup(roomCode, uid, Date.now(), database); }
    catch (error) { console.warn('Lobby idle cleanup will retry:', error); }
    finally { running = false; }
  };
  void run();
  const interval = window.setInterval(() => { void run(); }, 60_000);
  const onVisibilityChange = () => { if (document.visibilityState === 'visible') void run(); };
  document.addEventListener('visibilitychange', onVisibilityChange);
  return () => {
    stopped = true;
    window.clearInterval(interval);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
