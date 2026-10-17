const scenario = new URLSearchParams(location.search).get('scenario');
const card = (character: string, isDead = false) => ({ character, isDead });
const state: any = {
  schemaVersion: 2, status: 'playing', adminId: 'player1', gameState: 'waiting_for_action',
  turnOrder: ['player1', 'player2', 'player3'], currentTurnIndex: scenario === 'waiting' ? 1 : 0,
  gameStartedAt: Date.now(), deckCount: 2, passVotes: [], actionLog: 'ทดสอบเลย์เอาท์ด้วยข้อมูลจำลอง',
  pendingAction: null, discardTarget: null, afterDiscardState: null,
};
const publicPlayers: any[] = [
  { id: 'player1', name: 'ผู้เล่นทดสอบชื่อยาวเพื่อดูการตัดบรรทัด', coins: scenario === 'coins10' ? 10 : 7, isDead: false, influenceCount: 2, revealedCards: [] },
  { id: 'player2', name: 'คู่แข่งชื่อยาวมากABCDEFGHIJKLMNOPQRSTUVWXYZ', coins: 12, isDead: false, influenceCount: 1, revealedCards: [{ slot: 0, character: 'Ambassador' }] },
  { id: 'player3', name: 'ผู้เล่นที่ตกรอบ', coins: 0, isDead: true, influenceCount: 0, revealedCards: [{ slot: 0, character: 'Ambassador' }, { slot: 1, character: 'Contessa' }] },
];
const privateState: Record<string, any> = {
  player1: { cards: [card('Duke'), card('Ambassador')], exchangeOptions: [] },
  player2: { cards: [card('Ambassador', true), card('Captain')], exchangeOptions: [] },
  player3: { cards: [card('Ambassador', true), card('Contessa', true)], exchangeOptions: [] },
};
if (scenario === 'room') {
  state.status = 'lobby';
  ['player4', 'player5', 'player6'].forEach((id, index) => publicPlayers.push({
    id, name: `ผู้เล่นทดสอบ ${index + 4}`, coins: 2, isDead: false, influenceCount: 2, revealedCards: [],
  }));
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
Object.assign(globalThis, {
  __coupUiFixture: { setHand: setFixtureHand },
  __coupUiCallable: async (name: string, payload: any = {}) => {
    if (name === 'createRoom') return { roomCode: 'ABCDEFGH' };
    if (name === 'joinRoom') return { roomCode: payload.roomCode };
    if (name === 'startGame') { state.status = 'playing'; state.gameState = 'waiting_for_action'; emit(); return { started: true }; }
    if (name === 'leaveRoom') { state.status = 'lobby'; emit(); return { left: true }; }
    if (name === 'kickPlayer') return { removed: true };
    if (name === 'resetGame') { state.status = 'lobby'; state.gameState = 'lobby'; emit(); return { reset: true }; }
    if (name === 'submitGameCommand') {
      const command = payload.command;
      if (command.type === 'action') {
        if (command.actionName === 'Income') {
          publicPlayers[0].coins += 1;
          state.actionLog = 'ผู้เล่นทดสอบใช้ Income ได้รับ 1 เหรียญ';
        } else {
          state.gameState = 'waiting_for_responses';
          state.pendingAction = { actionName: command.actionName, sourceId: 'player1', targetId: command.targetId ?? null, blockerId: null, blockCharacter: null };
          state.passVotes = [];
        }
      } else if (command.type === 'respond' && command.response === 'pass') {
        state.passVotes = [...new Set([...state.passVotes, 'player1'])];
      } else if (command.type === 'respond' && command.response === 'block') {
        state.gameState = 'waiting_for_block_responses';
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
      emit();
      return { commandId: 'fixture-command' };
    }
    return { active: true, expiresAt: Date.now() + 1800000, idleExempt: false };
  },
});

const listenersFor = (ref: any) => {
  const notify = () => {
    if (ref.path.endsWith('/players')) return playerSnapshot();
    if (ref.path.includes('/privatePlayers/')) return snapshot(ref.path.split('/').pop(), privateState[ref.path.split('/').pop()]);
    return snapshot('TEST', { ...state });
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
export function onSnapshot(ref: any, next: any) {
  const notify = () => next(listenersFor(ref)());
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
