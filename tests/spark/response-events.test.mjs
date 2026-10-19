import test from 'node:test';
import assert from 'node:assert/strict';
import { applyGameCommand } from '../../src/core/gameEngine.ts';
import { buildPublicGameEvent, summarizeRound } from '../../src/core/gameEvents.ts';
import { getResponseSecondsLeft } from '../../src/core/responseTiming.ts';

function game() {
  return {
    room: { schemaVersion: 3, roundId: 'round-1', turnNumber: 1, status: 'playing', adminId: 'a',
      gameState: 'waiting_for_action', turnOrder: ['a', 'b'], currentTurnIndex: 0, passVotes: [] },
    players: Object.fromEntries(['a', 'b'].map(id => [id, { name: id, coins: 7, isDead: false, influenceCount: 2, revealedCards: [] }])),
    privatePlayers: { a: { cards: [{ character: 'Duke', isDead: false, id: 'a1' }, { character: 'Captain', isDead: false, id: 'a2' }], exchangeOptions: [] },
      b: { cards: [{ character: 'Contessa', isDead: false, id: 'b1' }, { character: 'Assassin', isDead: false, id: 'b2' }], exchangeOptions: [] } },
    deck: ['Ambassador', 'Captain', 'Assassin'], now: 1000,
  };
}
test('a response has one persisted deadline across reads/reloads; a block starts a distinct window', () => {
  const state = game();
  applyGameCommand(state, 'a', { type: 'action', actionName: 'Steal', targetId: 'b' });
  const windowId = state.room.responseWindowId;
  assert.equal(getResponseSecondsLeft(state.room, 6000), 10);
  assert.equal(getResponseSecondsLeft(structuredClone(state.room), 11000), 5);
  state.now = 7000;
  applyGameCommand(state, 'b', { type: 'respond', response: 'block', character: 'Captain', responseWindowId: windowId });
  assert.notEqual(state.room.responseWindowId, windowId);
  assert.equal(getResponseSecondsLeft(state.room, 11000), 11);
  assert.throws(() => applyGameCommand(state, 'a', { type: 'respond', response: 'pass', responseWindowId: windowId }), /เปลี่ยน/);
});
test('only the host expires a due window, once, and manual late responses fail', () => {
  const state = game();
  applyGameCommand(state, 'a', { type: 'action', actionName: 'Tax' });
  const responseWindowId = state.room.responseWindowId;
  assert.throws(() => applyGameCommand(state, 'a', { type: 'expireResponses', responseWindowId }), /ยังไม่หมด/);
  state.now = 16000;
  assert.throws(() => applyGameCommand(state, 'b', { type: 'expireResponses', responseWindowId }), /เจ้าของ/);
  assert.throws(() => applyGameCommand(state, 'b', { type: 'respond', response: 'challenge', responseWindowId }), /หมดเวลา/);
  applyGameCommand(state, 'a', { type: 'expireResponses', responseWindowId });
  assert.equal(state.players.a.coins, 10);
  assert.equal(state.room.turnNumber, 2);
  assert.equal(state.room.responseStartedAt, null);
  assert.throws(() => applyGameCommand(state, 'a', { type: 'expireResponses', responseWindowId }));
});
test('public history contains deltas and proven challenge outcome, never private hands/options/replacement', () => {
  const state = game();
  const before = structuredClone(state);
  const command = { type: 'action', actionName: 'Income' };
  applyGameCommand(state, 'a', command);
  const event = buildPublicGameEvent(before, state, 'a', command);
  assert.deepEqual(event.coinChanges, [{ playerId: 'a', playerName: 'a', before: 7, after: 8 }]);
  assert.equal(event.turnNumber, 1);
  for (const key of ['privatePlayers', 'exchangeOptions', 'cards', 'deck', 'cardIndexes', 'a1', 'b1']) {
    assert.equal(JSON.stringify(event).includes(`"${key}"`), false, key);
  }
  const challenged = game();
  applyGameCommand(challenged, 'a', { type: 'action', actionName: 'Tax' });
  const preChallenge = structuredClone(challenged);
  const challenge = { type: 'respond', response: 'challenge', responseWindowId: challenged.room.responseWindowId };
  applyGameCommand(challenged, 'b', challenge);
  const result = buildPublicGameEvent(preChallenge, challenged, 'b', challenge);
  assert.equal(result.challengeSucceeded, false);
  assert.equal(result.claimedRole, 'Duke');
  assert.equal(result.outcome.includes('มี Duke จริง'), true);
  assert.equal(JSON.stringify(result).includes('replacement'), false);
});
test('summary counts completed turns/challenges from actual current-round events only', () => {
  const summary = summarizeRound([
    { sequence: 1, turnNumber: 1, kind: 'start', at: 1000 },
    { sequence: 2, turnNumber: 1, kind: 'challenge', at: 2000, challengeSucceeded: true },
    { sequence: 3, turnNumber: 2, kind: 'action', at: 65000 },
  ]);
  assert.equal(summary.turns, 2);
  assert.equal(summary.successfulChallenges, 1);
  assert.equal(summary.durationSeconds, 64);
});

test('stale target confirmations cannot act in a different round or turn', () => {
  const state = game();
  assert.throws(() => applyGameCommand(state, 'a', { type: 'action', actionName: 'Coup', targetId: 'b', expectedRoundId: 'old-round' }), /เปลี่ยน/);
  assert.throws(() => applyGameCommand(state, 'a', { type: 'action', actionName: 'Coup', targetId: 'b', expectedTurnNumber: 2 }), /เปลี่ยน/);
  assert.equal(state.players.a.coins, 7);
  assert.equal(state.room.gameState, 'waiting_for_action');
});
