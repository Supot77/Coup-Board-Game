import test from 'node:test';
import assert from 'node:assert/strict';
import { applyGameCommand, GameRuleError, isIdleExempt } from '../../src/core/gameEngine.ts';

const card = (character, isDead = false, id = character) => ({ character, isDead, id });
function game({ turnOrder = ['a', 'b', 'c'], coins = { a: 2, b: 2, c: 2 }, hands = {} } = {}) {
  const players = {};
  const privatePlayers = {};
  for (const uid of turnOrder) {
    players[uid] = { name: uid.toUpperCase(), coins: coins[uid] ?? 2, isDead: false, influenceCount: 2, revealedCards: [] };
    privatePlayers[uid] = { cards: hands[uid] ?? [card('Duke', false, `${uid}-1`), card('Contessa', false, `${uid}-2`)], exchangeOptions: [] };
  }
  return {
    room: {
      schemaVersion: 2, status: 'playing', gameState: 'waiting_for_action', adminId: 'a',
      turnOrder, currentTurnIndex: 0, passVotes: [], pendingAction: null,
    },
    players, privatePlayers, deck: ['Captain', 'Assassin', 'Ambassador', 'Contessa'], now: 1000,
  };
}
function run(state, actor, command) { return applyGameCommand(state, actor, command); }

test('rejects a game action from the wrong turn', () => {
  assert.throws(() => run(game(), 'b', { type: 'action', actionName: 'Income' }), GameRuleError);
});

test('resolves Income and enforces the mandatory Coup rule at ten coins', () => {
  const state = game({ coins: { a: 9, b: 2, c: 2 } });
  run(state, 'a', { type: 'action', actionName: 'Income' });
  assert.equal(state.players.a.coins, 10);
  assert.equal(state.room.gameState, 'waiting_for_action');
  state.room.currentTurnIndex = 0;
  assert.throws(() => run(state, 'a', { type: 'action', actionName: 'Tax' }), /10 เหรียญ/);
});

test('a truthful Tax challenge replaces the proof and still resolves after the challenger discards', () => {
  const state = game({ hands: { a: [card('Duke', false, 'proof'), card('Captain', false, 'secret')] } });
  run(state, 'a', { type: 'action', actionName: 'Tax' });
  run(state, 'b', { type: 'respond', response: 'challenge' });
  assert.equal(state.room.gameState, 'waiting_for_discard');
  assert.equal(state.players.a.revealedCards.length, 0);
  assert.notEqual(state.privatePlayers.a.cards[0].character, 'Duke');
  run(state, 'b', { type: 'discard', cardIndex: 0 });
  assert.equal(state.players.a.coins, 5);
  assert.equal(state.room.gameState, 'waiting_for_action');
  assert.deepEqual(state.players.b.revealedCards, [{ slot: 0, character: 'Duke' }]);
});

test('a false action challenge makes the claimant lose influence and ends the action', () => {
  const state = game({ hands: { a: [card('Captain'), card('Ambassador')] } });
  run(state, 'a', { type: 'action', actionName: 'Tax' });
  run(state, 'b', { type: 'respond', response: 'challenge' });
  assert.equal(state.room.discardTarget, 'a');
  run(state, 'a', { type: 'discard', cardIndex: 0 });
  assert.equal(state.players.a.coins, 2);
  assert.equal(state.players.a.influenceCount, 1);
  assert.equal(state.room.gameState, 'waiting_for_action');
  assert.equal(state.room.currentTurnIndex, 1);
});

test('Assassinate charges three coins, resolves passes, and eliminates the target only after discard', () => {
  const state = game({ coins: { a: 4, b: 2, c: 2 }, hands: { b: [card('Duke'), card('Contessa')] } });
  state.players.b.influenceCount = 1;
  state.players.b.revealedCards = [{ slot: 0, character: 'Duke' }];
  state.privatePlayers.b.cards[0].isDead = true;
  run(state, 'a', { type: 'action', actionName: 'Assassinate', targetId: 'b' });
  assert.equal(state.players.a.coins, 1);
  run(state, 'b', { type: 'respond', response: 'pass' });
  run(state, 'c', { type: 'respond', response: 'pass' });
  assert.equal(state.room.gameState, 'waiting_for_discard');
  run(state, 'b', { type: 'discard', cardIndex: 1 });
  assert.equal(state.players.b.isDead, true);
  assert.equal(state.room.gameState, 'waiting_for_action');
  assert.equal(state.room.currentTurnIndex, 2);
});

test('a false block challenge discards the blocker and resumes the original action', () => {
  const state = game({ coins: { a: 2, b: 0, c: 2 }, hands: {
    a: [card('Captain'), card('Ambassador')],
    b: [card('Duke'), card('Contessa')],
  } });
  run(state, 'a', { type: 'action', actionName: 'Steal', targetId: 'b' });
  run(state, 'b', { type: 'respond', response: 'block', character: 'Captain' });
  run(state, 'c', { type: 'respond', response: 'challenge' });
  assert.equal(state.room.discardTarget, 'b');
  run(state, 'b', { type: 'discard', cardIndex: 0 });
  assert.equal(state.players.a.coins, 2);
  assert.equal(state.players.b.coins, 0);
  assert.equal(state.room.gameState, 'waiting_for_action');
});

test('exchange choices remain in the private player state and keep only the selected number', () => {
  const state = game();
  run(state, 'a', { type: 'action', actionName: 'Exchange' });
  run(state, 'b', { type: 'respond', response: 'pass' });
  run(state, 'c', { type: 'respond', response: 'pass' });
  assert.equal(state.room.gameState, 'waiting_for_exchange');
  assert.equal(state.privatePlayers.a.exchangeOptions.length, 4);
  run(state, 'a', { type: 'exchange', cardIndexes: [1, 3] });
  assert.equal(state.privatePlayers.a.cards.length, 2);
  assert.deepEqual(state.privatePlayers.a.exchangeOptions, []);
  assert.equal(state.room.gameState, 'waiting_for_action');
});

test('idle exemption follows whose decision the server is waiting for', () => {
  const state = game();
  assert.equal(isIdleExempt(state.room, 'a', state.players), false);
  assert.equal(isIdleExempt(state.room, 'b', state.players), true);
  state.room.gameState = 'waiting_for_responses';
  state.room.pendingAction = { actionName: 'Tax', sourceId: 'a', targetId: null, blockerId: null, blockCharacter: null };
  assert.equal(isIdleExempt(state.room, 'a', state.players), true);
  assert.equal(isIdleExempt(state.room, 'b', state.players), false);
  state.room.passVotes = ['b'];
  assert.equal(isIdleExempt(state.room, 'b', state.players), true);
});
