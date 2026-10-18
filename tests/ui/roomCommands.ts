type Invoke = (name: string, payload?: unknown) => Promise<any>;
const invoke = (name: string, payload: unknown = {}) =>
  (globalThis as typeof globalThis & { __coupUiCallable: Invoke }).__coupUiCallable(name, payload);

export const createRoom = async (displayName: string, avatarId: string) => invoke('createRoom', { displayName, avatarId });
export const joinRoom = async (roomCode: string, displayName: string, avatarId: string) => invoke('joinRoom', { roomCode, displayName, avatarId });
export const setPlayerReady = async (_roomCode: string, isReady: boolean) => invoke('setPlayerReady', { isReady });
export const leaveRoom = async () => invoke('leaveRoom');
export const kickPlayer = async (_roomCode: string, playerId: string) => invoke('kickPlayer', { playerId });
export const startGame = async () => invoke('startGame');
export const resetGame = async () => invoke('resetGame');

export function getCallableMessage(error: unknown) {
  return (error as { message?: string })?.message || 'ทำรายการไม่สำเร็จ กรุณาลองใหม่';
}
