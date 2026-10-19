import { buildPublicGameEvent } from '../../src/core/gameEvents';
const scenario = new URLSearchParams(location.search).get('scenario');
const card = (character: string, isDead = false) => ({ character, isDead });
const state: any = {
  roundId: 'fixture-round', eventSequence: 1, turnNumber: 1, hostSeenAt: Date.now(), responseSequence: 0,
  schemaVersion: 3, status: 'playing', adminId: 'player1', gameState: 'waiting_for_action',
  turnOrder: ['player1', 'player2', 'player3'], currentTurnIndex: scenario === 'waiting' ? 1 : 0,
  gameStartedAt: Date.now(), deckCount: 2, passVotes: [], actionLog: 'ทดสอบเลย์เอาท์ด้วยข้อมูลจำลอง',
  pendingAction: null, discardTarget: null, afterDiscardState: null,
};
const configuredSeconds = new URLSearchParams(location.search).get('responseSeconds');
if (configuredSeconds !== null) state.responseTimeoutSeconds = Number(configuredSeconds);
const submittedCommands: any[] = [];
const publicEvents: any[] = [];
let resultDelayMs = 0;
let submitDelayMs = 0;
let privateHandCached = false;
const publicPlayers: any[] = [
  { id: 'player1', name: 'ผู้เล่นทดสอบชื่อยาวเพื่อดูการตัดบรรทัด', coins: scenario === 'coins10' ? 10 : 7, isDead: false, influenceCount: 2, revealedCards: [], avatarId: 'male', isReady: false },
  { id: 'player2', name: 'คู่แข่งชื่อยาวมากABCDEFGHIJKLMNOPQRSTUVWXYZ', coins: 12, isDead: false, influenceCount: 1, revealedCards: [{ slot: 0, character: 'Ambassador' }], avatarId: 'female', isReady: false },
  { id: 'player3', name: 'ผู้เล่นที่ตกรอบ', coins: 0, isDead: true, influenceCount: 0, revealedCards: [{ slot: 0, character: 'Ambassador' }, { slot: 1, character: 'Contessa' }], avatarId: 'male', isReady: false },
];
const privateState: Record<string, any> = {
  player1: { cards: [card('Duke'), card('Ambassador')], exchangeOptions: [] },
  player2: { cards: [card('Ambassador', true), card('Captain')], exchangeOptions: [] },
  player3: { cards: [card('Ambassador', true), card('Contessa', true)], exchangeOptions: [] },
};
if (['room', 'room-1', 'room-2', 'room-6', 'room-member', 'room-stale'].includes(scenario ?? '')) {
  state.status = 'lobby';
  if (scenario === 'room-1') publicPlayers.splice(1);
  if (scenario === 'room-2') publicPlayers.splice(2);
  if (scenario === 'room' || scenario === 'room-6') {
    ['player4', 'player5', 'player6'].forEach((id, index) => publicPlayers.push({
      id, name: `ผู้เล่นทดสอบ ${index + 4}`, coins: 2, isDead: false, influenceCount: 2, revealedCards: [],
      avatarId: index % 2 === 0 ? 'female' : 'male', isReady: false,
    }));
  }
  if (scenario === 'room-member') state.adminId = 'player2';
}
if (['response', 'foreignaid', 'block', 'assassination', 'tax', 'other-target', 'response-revealed'].includes(scenario ?? '')) {
  state.gameState = scenario === 'block' ? 'waiting_for_block_responses' : 'waiting_for_responses';
  state.pendingAction = {
    actionName: scenario === 'foreignaid' ? 'ForeignAid' : scenario === 'assassination' ? 'Assassinate' : scenario === 'tax' ? 'Tax' : 'Steal',
    sourceId: 'player2', targetId: scenario === 'foreignaid' || scenario === 'tax' ? null : scenario === 'other-target' ? 'player3' : 'player1',
    blockerId: scenario === 'block' ? 'player3' : null, blockCharacter: 'Ambassador',
  };
}
if (scenario === 'discard') { state.gameState = 'waiting_for_discard'; state.discardTarget = 'player1'; }
if (scenario === 'discard-other') { state.gameState = 'waiting_for_discard'; state.discardTarget = 'player2'; }
if (scenario === 'exchange-other') { state.gameState = 'waiting_for_exchange'; state.currentTurnIndex = 1; }
if (scenario === 'exchange') {
  state.gameState = 'waiting_for_exchange';
  privateState.player1.exchangeOptions = [card('Duke'), card('Ambassador'), card('Captain'), card('Contessa')];
}
if (scenario === 'role-revealed' || scenario === 'response-revealed') {
  privateState.player1.cards[1].isDead = true;
  publicPlayers[0].revealedCards = [{ slot: 1, character: 'Ambassador' }];
  publicPlayers[0].influenceCount = 1;
}
if (scenario === 'dead' || scenario === 'gameover') {
  publicPlayers[0].isDead = true;
  publicPlayers[0].influenceCount = 0;
  publicPlayers[0].revealedCards = [{ slot: 0, character: 'Duke' }, { slot: 1, character: 'Ambassador' }];
  privateState.player1.cards.forEach((item: any) => item.isDead = true);
}
if (scenario === 'dead') {
  publicPlayers[2].isDead = false;
  publicPlayers[2].influenceCount = 1;
  privateState.player3.cards[1].isDead = false;
}
if (scenario === 'gameover') state.gameState = 'game_over';


if (state.status === 'playing') {
  publicEvents.push({ id: 'start', roundId: state.roundId, sequence: 1, turnNumber: 1, actionId: '', kind: 'start', actorId: 'player1', actorName: publicPlayers[0].name,
    sourceId: null, targetId: null, targetName: null, actionName: null, claimedRole: null, challengeSucceeded: null,
    outcome: 'เกมเริ่มแล้ว', at: state.gameStartedAt, coinChanges: [], influenceChanges: [] });
}
const openFixtureWindow = () => {
  state.responseSequence += 1;
  state.responseWindowId = `fixture:${state.responseSequence}`;
  state.responseStartedAt = Date.now();
};
if (['waiting_for_responses', 'waiting_for_block_responses'].includes(state.gameState)) {
  openFixtureWindow();
  if (new URLSearchParams(location.search).get('persistClock') === '1') {
    const key = `fixture_clock_${scenario}`;
    state.responseStartedAt = Number(sessionStorage.getItem(key) ?? state.responseStartedAt);
    sessionStorage.setItem(key, String(state.responseStartedAt));
  }
}
if (scenario === 'history' || scenario === 'gameover') {
  state.gameStartedAt = Date.now() - 125000;
  publicEvents[0].at = state.gameStartedAt;
  publicEvents.push({ ...publicEvents[0], id: 'tax-event', sequence: 2, kind: 'action', turnNumber: 3,
    actorId: 'player2', actorName: publicPlayers[1].name, sourceId: 'player2', actionName: 'Tax', claimedRole: 'Duke',
    outcome: 'เมย์ใช้ Tax ได้รับ 3 เหรียญ', at: state.gameStartedAt + 30000,
    coinChanges: [{ playerId: 'player2', playerName: 'เมย์', before: 9, after: 12 }] });
  publicEvents.push({ ...publicEvents[0], id: 'challenge-event', sequence: 3, kind: 'challenge', turnNumber: 5,
    actorId: 'player1', actorName: publicPlayers[0].name, sourceId: 'player2', actionName: 'Steal', claimedRole: 'Captain', challengeSucceeded: true,
    outcome: 'คุณจับโกหกสำเร็จ อีกฝ่ายต้องเปิดเผยไพ่ 1 ใบ', at: state.gameStartedAt + 90000 });
  state.eventSequence = 3; state.turnNumber = 5;
  if (scenario === 'gameover') state.gameEndedAt = Date.now();
}

let streamError: string | null = scenario === 'room-stale' ? 'permission-denied' : null;
let leaveError: string | null = null;
let missingRoom = false;
let cachedMissing = false;
const listeners = new Set<() => void>();
const emit = () => { for (const notify of [...listeners]) notify(); };
const playerData = (uid: string) => {
  const { id, ...data } = publicPlayers.find(player => player.id === uid) ?? {};
  return data;
};
const setFixtureHand = (cards: any[]) => {
  privateState.player1.cards = cards;
  const living = cards.filter(item => !item.isDead);
  publicPlayers[0].influenceCount = living.length;
  publicPlayers[0].isDead = living.length === 0;
  publicPlayers[0].revealedCards = cards.flatMap((item, slot) => item.isDead ? [{ slot, character: item.character }] : []);
  emit();
};
const setFixtureReady = (isReady: boolean) => {
  publicPlayers[0].isReady = isReady;
  emit();
};
const setFixtureAllReady = (isReady: boolean) => {
  publicPlayers.forEach(player => { player.isReady = isReady; });
  emit();
};
const addFixturePlayer = () => {
  const index = publicPlayers.length + 1;
  publicPlayers.push({
    id: `player${index}`, name: `ผู้เล่นทดสอบ ${index}`, coins: 2, isDead: false, influenceCount: 2,
    revealedCards: [], avatarId: index % 2 === 0 ? 'female' : 'male', isReady: false,
  });
  emit();
};
Object.assign(globalThis, {
  __coupUiFixture: {
    submittedCommands, publicEvents,
    setCommandDelays: (submit: number, result: number) => { submitDelayMs = submit; resultDelayMs = result; },
    setResponseStart: (at: number) => { state.responseStartedAt = at;
      if (new URLSearchParams(location.search).get('persistClock') === '1') sessionStorage.setItem(`fixture_clock_${scenario}`, String(at));
      emit(); },
    setHostSeen: (at: number) => { state.hostSeenAt = at; emit(); },
    setTurnOrder: (ids: string[]) => { state.turnOrder = ids; emit(); },
    addPublicEvent: (event: any) => { state.eventSequence += 1; publicEvents.push({ ...publicEvents[0], ...event, id: `event-${state.eventSequence}`, sequence: state.eventSequence, at: Date.now() }); emit(); },
    setPrivateCache: (cached: boolean) => { privateHandCached = cached; emit(); },
    setEvent: (actionName: string, blockCharacter: string | null = null) => {
      openFixtureWindow();
      state.gameState = blockCharacter ? 'waiting_for_block_responses' : 'waiting_for_responses';
      state.passVotes = [];
      state.pendingAction = { actionName, sourceId: 'player2', targetId: ['Steal', 'Assassinate'].includes(actionName) ? 'player1' : null,
        blockerId: blockCharacter ? 'player3' : null, blockCharacter };
      emit();
    },
    setResponseTime: (seconds: number) => { state.responseTimeoutSeconds = seconds; emit(); },
    setTurn: (index: number) => { state.gameState = 'waiting_for_action'; state.currentTurnIndex = index; state.responseStartedAt = null; state.responseWindowId = null; emit(); },
    passOther: () => { state.passVotes = ['player3']; emit(); },
    failLeave: (code: string) => { leaveError = code; },
    failRoom: (code: string) => { streamError = code; emit(); },
    removeRoom: (fromCache = false) => { missingRoom = true; cachedMissing = fromCache; emit(); },
    restoreRoom: () => { streamError = null; missingRoom = false; emit(); },
    setHand: setFixtureHand, setReady: setFixtureReady, setAllReady: setFixtureAllReady, addPlayer: addFixturePlayer },
  __coupUiCallable: async (name: string, payload: any = {}) => {
    if (name === 'createRoom') {
      state.status = 'lobby'; state.adminId = 'player1'; publicPlayers.splice(1);
      publicPlayers[0].avatarId = payload.avatarId; publicPlayers[0].isReady = false;
      emit(); return { roomCode: 'ABCDEFGH' };
    }
    if (name === 'joinRoom') {
      state.status = 'lobby'; publicPlayers[0].avatarId = payload.avatarId; emit();
      return { roomCode: payload.roomCode };
    }
    if (name === 'setResponseTimeout') { state.responseTimeoutSeconds = payload.seconds; emit(); return { updated: true }; }
    if (name === 'setPlayerReady') { setFixtureReady(payload.isReady); return { updated: true }; }
    if (name === 'startGame') { state.status = 'playing'; state.gameState = 'waiting_for_action'; emit(); return { started: true }; }
    if (name === 'leaveRoom') {
      if (leaveError) throw { code: leaveError };
      state.status = 'lobby'; emit(); return { left: true }; }
    if (name === 'kickPlayer') {
      const index = publicPlayers.findIndex(player => player.id === payload.playerId);
      if (index >= 0) publicPlayers.splice(index, 1);
      emit(); return { removed: true };
    }
    if (name === 'resetGame') { state.status = 'lobby'; state.gameState = 'lobby'; emit(); return { reset: true }; }
    if (name === 'waitForCommandResult') { if (resultDelayMs) await new Promise(resolve => setTimeout(resolve, resultDelayMs)); return { actorUid: 'player1', ok: true }; }
    if (name === 'submitGameCommand') {
      if (submitDelayMs) await new Promise(resolve => setTimeout(resolve, submitDelayMs));
      const before = { room: structuredClone(state), players: Object.fromEntries(publicPlayers.map(player => [player.id, structuredClone(player)])) };
      const command = payload.command;
      submittedCommands.push(command);
      if (command.type === 'action') {
        if (command.actionName === 'Income') {
          publicPlayers[0].coins += 1;
          state.actionLog = 'ผู้เล่นทดสอบใช้ Income ได้รับ 1 เหรียญ';
        } else {
          state.gameState = 'waiting_for_responses';
          openFixtureWindow();
          state.pendingAction = { actionName: command.actionName, sourceId: 'player1', targetId: command.targetId ?? null, blockerId: null, blockCharacter: null };
          state.passVotes = [];
        }
      } else if (command.type === 'respond' && command.response === 'pass') {
        state.passVotes = [...new Set([...state.passVotes, 'player1'])];
      } else if (command.type === 'respond' && command.response === 'block') {
        state.gameState = 'waiting_for_block_responses';
        openFixtureWindow();
        state.pendingAction = { ...state.pendingAction, blockerId: 'player1', blockCharacter: command.character };
      } else if (command.type === 'discard') {
        const target = privateState.player1.cards[command.cardIndex];
        target.isDead = true;
        publicPlayers[0].revealedCards.push({ slot: command.cardIndex, character: target.character });
        publicPlayers[0].influenceCount -= 1;
      } else if (command.type === 'exchange') {
        privateState.player1.exchangeOptions = [];
        state.gameState = 'waiting_for_action';
      }
      const event = buildPublicGameEvent(before, { room: state, players: Object.fromEntries(publicPlayers.map(player => [player.id, player])) }, 'player1', command);
      state.eventSequence = event.sequence; publicEvents.push({ ...event, id: `command-${event.sequence}`, at: Date.now() });
      emit();
      return { commandId: 'fixture-command' };
    }
    return { active: true, expiresAt: Date.now() + 1800000, idleExempt: false };
  },
});

const listenersFor = (ref: any) => {
  const notify = () => {
    if (ref.path.endsWith('/events')) { const docs = publicEvents.filter(event => !ref.constraints?.length || ref.constraints.every((filter: any) => event[filter.field] === filter.value)).map(event => snapshot(event.id, event)); return { docs, size: docs.length, metadata: { fromCache: cachedMissing } }; }
    if (ref.path.endsWith('/players')) return playerSnapshot();
    if (ref.path.includes('/privatePlayers/')) return { ...snapshot(ref.path.split('/').pop(), privateState[ref.path.split('/').pop()]), metadata: { fromCache: privateHandCached } };
    return { ...snapshot('TEST', missingRoom ? null : { ...state }), metadata: { fromCache: cachedMissing } };
  };
  return notify;
};
const snapshot = (id: string, data: any) => ({ id, ref: { path: `rooms/TEST/${id}` }, exists: () => !!data, data: () => data });
const playerSnapshot = () => {
  const docs = publicPlayers.map(player => snapshot(player.id, playerData(player.id)));
  return { docs, size: docs.length, forEach: (callback: any) => docs.forEach(callback) };
};
export const getFirestore = () => ({});
export const doc = (_db: any, ...parts: string[]) => ({ path: parts.join('/') });
export const collection = doc;
export const where = (field: string, _op: string, value: unknown) => ({ field, value });
export const query = (ref: any, ...constraints: any[]) => ({ ...ref, constraints });
export function onSnapshot(ref: any, optionsOrNext: any, nextOrError?: any, errorCallback?: any) {
  const next = typeof optionsOrNext === 'function' ? optionsOrNext : nextOrError;
  const error = typeof optionsOrNext === 'function' ? nextOrError : errorCallback;
  const notify = () => streamError ? error?.({ code: streamError }) : next(listenersFor(ref)());
  listeners.add(notify); notify();
  return () => listeners.delete(notify);
}
export const getDoc = async (ref: any) => {
  if (ref.path.includes('/privatePlayers/')) return snapshot(ref.path.split('/').pop(), privateState[ref.path.split('/').pop()]);
  if (ref.path.includes('/players/')) return snapshot(ref.path.split('/').pop(), playerData(ref.path.split('/').pop()));
  return snapshot('TEST', state);
};
export const getDocs = async () => playerSnapshot();
export const setDoc = async () => { throw Error('UI fixture does not create live documents'); };
export const deleteDoc = async () => { throw Error('UI fixture does not delete live documents'); };
export const increment = (value: number) => ({ increment: value });
export const arrayUnion = (value: string) => ({ arrayUnion: value });
export const updateDoc = async () => { throw Error('UI fixture mutations are not used by the read-only preview'); };
export const writeBatch = () => { throw Error('UI fixture does not support direct batch writes'); };
