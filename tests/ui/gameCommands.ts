export type GameCommand = (
  | { type: 'action'; actionName: string; targetId?: string }
  | { type: 'respond'; response: 'pass' | 'challenge' | 'block'; character?: string; responseWindowId?: string }
  | { type: 'discard'; cardIndex: number }
  | { type: 'exchange'; cardIndexes: number[] }
  | { type: 'surrender' }
  | { type: 'expireResponses'; responseWindowId: string }) & { expectedRoundId?: string; expectedTurnNumber?: number };

export async function submitGameCommand(_roomCode: string, _uid: string, command: GameCommand, _database?: unknown, onAssigned?: (id: string) => void) {
  onAssigned?.('fixture-command');
  return (globalThis as typeof globalThis & { __coupUiCallable: (name: string, payload: unknown) => Promise<any> })
    .__coupUiCallable('submitGameCommand', { command });
}

export async function waitForCommandResult() {
  return (globalThis as any).__coupUiCallable('waitForCommandResult');
}
