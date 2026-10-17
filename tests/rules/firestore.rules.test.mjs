import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, writeBatch,
} from 'firebase/firestore';

const projectId = 'demo-coup-rules';
let env;
const staleAt = new Date(Date.now() - 31 * 60 * 1000);

before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: { rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  });
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    const publicPlayer = { name: 'Player', coins: 2, isDead: false, influenceCount: 2, revealedCards: [] };
    await setDoc(doc(db, 'rooms/GAMEPLAY'), {
      schemaVersion: 3, status: 'playing', gameState: 'waiting_for_action', adminId: 'host', cleanupStarted: false,
      lastActivityAt: new Date(), turnOrder: ['host', 'guest'], currentTurnIndex: 0,
    });
    await setDoc(doc(db, 'roomInvites/GAMEPLAY'), { schemaVersion: 3, status: 'playing', playerCount: 2 });
    await setDoc(doc(db, 'rooms/GAMEPLAY/players/host'), { ...publicPlayer, name: 'Host' });
    await setDoc(doc(db, 'rooms/GAMEPLAY/players/guest'), { ...publicPlayer, name: 'Guest' });
    await setDoc(doc(db, 'rooms/GAMEPLAY/privatePlayers/host'), { cards: [{ character: 'Duke', isDead: false }], exchangeOptions: [] });
    await setDoc(doc(db, 'rooms/GAMEPLAY/privatePlayers/guest'), { cards: [{ character: 'Assassin', isDead: false }], exchangeOptions: [] });
    await setDoc(doc(db, 'rooms/GAMEPLAY/internal/state'), { deck: ['Contessa'] });

    await setDoc(doc(db, 'rooms/BCDEFGHJ'), {
      schemaVersion: 3, status: 'lobby', gameState: 'lobby', adminId: 'host', cleanupStarted: false, lastActivityAt: new Date(),
    });
    await setDoc(doc(db, 'roomInvites/BCDEFGHJ'), { schemaVersion: 3, status: 'lobby', playerCount: 1 });
    await setDoc(doc(db, 'rooms/BCDEFGHJ/players/host'), { ...publicPlayer, name: 'Host' });
    await setDoc(doc(db, 'rooms/BCDEFGHJ/privatePlayers/host'), { cards: [], exchangeOptions: [] });

    await setDoc(doc(db, 'rooms/STALELBB'), {
      schemaVersion: 3, status: 'lobby', gameState: 'lobby', adminId: 'host', cleanupStarted: false, lastActivityAt: staleAt,
    });
    await setDoc(doc(db, 'roomInvites/STALELBB'), { schemaVersion: 3, status: 'lobby', playerCount: 1 });
    await setDoc(doc(db, 'rooms/STALELBB/players/guest'), { ...publicPlayer, name: 'Guest' });
    await setDoc(doc(db, 'rooms/STALELBB/privatePlayers/guest'), { cards: [], exchangeOptions: [] });
    await setDoc(doc(db, 'rooms/STALELBB/internal/state'), { deck: [] });

    await setDoc(doc(db, 'rooms/OLDROOM1'), { schemaVersion: 2, status: 'lobby' });
    await setDoc(doc(db, 'rooms/OLDROOM1/players/guest'), { name: 'Legacy' });
    await setDoc(doc(db, 'rooms/GAMEPLAY/commands/guest-pending'), {
      actorUid: 'guest', payload: { type: 'action', actionName: 'Income' }, createdAt: new Date(),
    });
  });
});

after(async () => { await env?.cleanup(); });

test('blocks unauthenticated users, nonmembers, legacy rooms, and invite enumeration', async () => {
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'rooms/GAMEPLAY')));
  const outsider = env.authenticatedContext('outsider').firestore();
  await assertFails(getDoc(doc(outsider, 'rooms/GAMEPLAY')));
  await assertFails(getDoc(doc(env.authenticatedContext('guest').firestore(), 'rooms/OLDROOM1')));
  await assertSucceeds(getDoc(doc(outsider, 'roomInvites/GAMEPLAY')));
  await assertFails(getDocs(collection(outsider, 'roomInvites')));
});

test('members read the public room and roster while private cards remain owner-only except for the host', async () => {
  const host = env.authenticatedContext('host').firestore();
  const guest = env.authenticatedContext('guest').firestore();
  await assertSucceeds(getDoc(doc(guest, 'rooms/GAMEPLAY')));
  assert.equal((await assertSucceeds(getDocs(collection(guest, 'rooms/GAMEPLAY/players')))).size, 2);
  await assertSucceeds(getDoc(doc(guest, 'rooms/GAMEPLAY/privatePlayers/guest')));
  await assertFails(getDoc(doc(guest, 'rooms/GAMEPLAY/privatePlayers/host')));
  await assertSucceeds(getDoc(doc(host, 'rooms/GAMEPLAY/privatePlayers/guest')));
  await assertFails(getDocs(collection(guest, 'rooms/GAMEPLAY/privatePlayers')));
  await assertFails(getDoc(doc(guest, 'rooms/GAMEPLAY/internal/state')));
  await assertSucceeds(getDoc(doc(host, 'rooms/GAMEPLAY/internal/state')));
});

test('join atomically adds one member and rejects writes that bypass membership or the six-player cap', async () => {
  const guest = env.authenticatedContext('guest').firestore();
  const joinBatch = writeBatch(guest);
  joinBatch.update(doc(guest, 'roomInvites/BCDEFGHJ'), { playerCount: 2 });
  joinBatch.set(doc(guest, 'rooms/BCDEFGHJ/players/guest'), {
    name: 'Guest', coins: 2, isDead: false, influenceCount: 2, revealedCards: [],
  });
  joinBatch.set(doc(guest, 'rooms/BCDEFGHJ/privatePlayers/guest'), { cards: [], exchangeOptions: [] });
  await assertSucceeds(joinBatch.commit());
  await assertSucceeds(getDoc(doc(guest, 'rooms/BCDEFGHJ')));

  await assertFails(updateDoc(doc(guest, 'rooms/GAMEPLAY/players/guest'), { coins: 500 }));
  const fullRoom = env.authenticatedContext('outsider').firestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'rooms/FULLROOM'), { schemaVersion: 3, status: 'lobby', adminId: 'host', cleanupStarted: false });
    await setDoc(doc(db, 'roomInvites/FULLROOM'), { schemaVersion: 3, status: 'lobby', playerCount: 6 });
  });
  const fullBatch = writeBatch(fullRoom);
  fullBatch.update(doc(fullRoom, 'roomInvites/FULLROOM'), { playerCount: 7 });
  fullBatch.set(doc(fullRoom, 'rooms/FULLROOM/players/outsider'), {
    name: 'Outsider', coins: 2, isDead: false, influenceCount: 2, revealedCards: [],
  });
  fullBatch.set(doc(fullRoom, 'rooms/FULLROOM/privatePlayers/outsider'), { cards: [], exchangeOptions: [] });
  await assertFails(fullBatch.commit());
});

test('members can submit only their own immutable command; only the room host can write a result', async () => {
  const guest = env.authenticatedContext('guest').firestore();
  await assertSucceeds(setDoc(doc(guest, 'rooms/GAMEPLAY/commands/new-command'), {
    actorUid: 'guest', payload: { type: 'action', actionName: 'Income' }, createdAt: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(guest, 'rooms/GAMEPLAY/commands/forged-command'), {
    actorUid: 'host', payload: { type: 'action', actionName: 'Income' }, createdAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(guest, 'rooms/GAMEPLAY/players/guest'), { coins: 50 }));
  await assertFails(setDoc(doc(guest, 'rooms/GAMEPLAY/commandResults/guest-pending'), {
    actorUid: 'guest', ok: true, message: 'done', completedAt: serverTimestamp(),
  }));
  const host = env.authenticatedContext('host').firestore();
  const completeCommand = writeBatch(host);
  completeCommand.set(doc(host, 'rooms/GAMEPLAY/commandResults/guest-pending'), {
    actorUid: 'guest', ok: true, message: 'done', completedAt: serverTimestamp(),
  });
  completeCommand.delete(doc(host, 'rooms/GAMEPLAY/commands/guest-pending'));
  await assertSucceeds(completeCommand.commit());
  await assertSucceeds(updateDoc(doc(host, 'rooms/GAMEPLAY/players/guest'), { coins: 500 }));
});

test('stale lobby members can mark cleanup and finish deletion in a separate batch', async () => {
  const guest = env.authenticatedContext('guest').firestore();
  const close = writeBatch(guest);
  close.update(doc(guest, 'rooms/STALELBB'), { cleanupStarted: true });
  close.update(doc(guest, 'roomInvites/STALELBB'), { status: 'closed' });
  close.set(doc(guest, 'rooms/STALELBB/cleanupMarkers/guest'), { createdAt: serverTimestamp() });
  await assertSucceeds(close.commit());

  const cleanup = writeBatch(guest);
  cleanup.delete(doc(guest, 'rooms/STALELBB/players/guest'));
  cleanup.delete(doc(guest, 'rooms/STALELBB/privatePlayers/guest'));
  cleanup.delete(doc(guest, 'rooms/STALELBB/internal/state'));
  cleanup.delete(doc(guest, 'roomInvites/STALELBB'));
  cleanup.delete(doc(guest, 'rooms/STALELBB/cleanupMarkers/guest'));
  cleanup.delete(doc(guest, 'rooms/STALELBB'));
  await assertSucceeds(cleanup.commit());
  await assertFails(getDoc(doc(guest, 'rooms/STALELBB')));
});
