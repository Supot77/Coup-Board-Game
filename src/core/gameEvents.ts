import type { Aggregate, Command } from './gameEngine.ts';
import { timestampMillis } from './responseTiming.ts';

export type PublicGameEvent = {
  id?: string;
  roundId: string;
  sequence: number;
  turnNumber: number;
  actionId: string;
  kind: 'start' | 'action' | 'pass' | 'block' | 'challenge' | 'discard' | 'exchange' | 'surrender' | 'timeout';
  actorId: string;
  actorName: string;
  sourceId: string | null;
  targetId: string | null;
  targetName: string | null;
  actionName: string | null;
  claimedRole: string | null;
  challengeSucceeded: boolean | null;
  outcome: string;
  at: unknown;
  coinChanges: { playerId: string; playerName: string; before: number; after: number }[];
  influenceChanges: { playerId: string; playerName: string; before: number; after: number; revealed: string[] }[];
};
type PublicState = Pick<Aggregate, 'room' | 'players'>;
const roles: Record<string, string> = { Tax: 'Duke', Assassinate: 'Assassin', Steal: 'Captain', Exchange: 'Ambassador' };

// Explicit public allowlist: this function never accepts or copies a private hand.
export function buildPublicGameEvent(before: PublicState, after: PublicState, actorId: string, command: Command): Omit<PublicGameEvent, 'at'> {
  const pending = before.room.pendingAction ?? after.room.pendingAction;
  const actionName = command.type === 'action' ? command.actionName : pending?.actionName ?? null;
  const targetId = command.type === 'action' ? command.targetId ?? null : pending?.targetId ?? null;
  const kind = command.type === 'respond' ? command.response : command.type === 'expireResponses' ? 'timeout' : command.type;
  const claimantId = before.room.gameState === 'waiting_for_block_responses' ? pending?.blockerId : pending?.sourceId;
  const claimedRole = command.type === 'respond' && command.response === 'block' ? command.character ?? null
    : before.room.gameState === 'waiting_for_block_responses' ? pending?.blockCharacter ?? null : roles[actionName ?? ''] ?? null;
  const coinChanges: PublicGameEvent['coinChanges'] = [];
  const influenceChanges: PublicGameEvent['influenceChanges'] = [];
  for (const [playerId, next] of Object.entries(after.players)) {
    const previous = before.players[playerId];
    if (!previous) continue;
    if (next.coins !== previous.coins) coinChanges.push({ playerId, playerName: next.name, before: previous.coins, after: next.coins });
    if (next.influenceCount !== previous.influenceCount) influenceChanges.push({
      playerId, playerName: next.name, before: previous.influenceCount, after: next.influenceCount,
      revealed: next.revealedCards.filter(card => !previous.revealedCards.some(old => old.slot === card.slot)).map(card => card.character),
    });
  }
  const actorName = after.players[actorId]?.name ?? 'เจ้าของห้อง';
  return {
    roundId: after.room.roundId ?? 'legacy', sequence: (before.room.eventSequence ?? 0) + 1,
    turnNumber: before.room.turnNumber ?? 1, actionId: after.room.currentActionId ?? before.room.currentActionId ?? '',
    kind, actorId, actorName, sourceId: command.type === 'action' ? actorId : pending?.sourceId ?? null,
    targetId, targetName: targetId ? after.players[targetId]?.name ?? null : null, actionName, claimedRole,
    challengeSucceeded: kind === 'challenge' ? after.room.discardTarget === claimantId : null,
    outcome: kind === 'pass' && before.room.actionLog === after.room.actionLog ? `${actorName} ปล่อยผ่าน`
      : kind === 'discard' && after.room.gameState !== 'game_over' ? `${actorName} เปิดเผย ${influenceChanges.flatMap(change => change.revealed).join(', ')} · ${after.room.actionLog}`
      : after.room.actionLog ?? 'ดำเนินเกมแล้ว',
    coinChanges, influenceChanges,
  };
}

export function summarizeRound(events: Partial<PublicGameEvent>[], endedAt?: unknown) {
  const timestamps = events.map(event => timestampMillis(event.at)).filter((value): value is number => value !== null);
  const first = timestamps.length ? Math.min(...timestamps) : null;
  const last = timestampMillis(endedAt) ?? (timestamps.length ? Math.max(...timestamps) : null);
  return {
    turns: events.length ? Math.max(...events.map(event => event.turnNumber ?? 1)) : 0,
    successfulChallenges: events.filter(event => event.kind === 'challenge' && event.challengeSucceeded === true).length,
    durationSeconds: first === null || last === null ? null : Math.max(0, Math.floor((last - first) / 1000)),
  };
}
