type Invoke = (name: string, payload?: unknown) => Promise<any>;
const invoke = (name: string, payload: unknown = {}) =>
  (globalThis as typeof globalThis & { __coupUiCallable: Invoke }).__coupUiCallable(name, payload);

export const createRoom = async (displayName: string) => invoke('createRoom', { displayName });
export const joinRoom = async (roomCode: string) => invoke('joinRoom', { roomCode });
export const leaveRoom = async () => invoke('leaveRoom');
export const kickPlayer = async () => invoke('kickPlayer');
export const startGame = async () => invoke('startGame');
export const resetGame = async () => invoke('resetGame');

export function getCallableMessage(error: unknown) {
  return (error as { message?: string })?.message || 'ทำรายการไม่สำเร็จ กรุณาลองใหม่';
}
