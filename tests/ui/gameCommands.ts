export type GameCommand =
  | { type: 'action'; actionName: string; targetId?: string }
  | { type: 'respond'; response: 'pass' | 'challenge' | 'block'; character?: string }
  | { type: 'discard'; cardIndex: number }
  | { type: 'exchange'; cardIndexes: number[] }
  | { type: 'surrender' };

export async function submitGameCommand(_roomCode: string, _uid: string, command: GameCommand) {
  return (globalThis as typeof globalThis & { __coupUiCallable: (name: string, payload: unknown) => Promise<any> })
    .__coupUiCallable('submitGameCommand', { command });
}

export async function waitForCommandResult() {
  return { actorUid: 'player1', ok: true, message: 'คำสั่งสำเร็จ' };
}
