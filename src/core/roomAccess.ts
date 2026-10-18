// A saved room is only a resume hint; membership is authoritative on the server.
export const ROOM_UNAVAILABLE_MESSAGE = 'ห้องนี้ปิดแล้วหรือคุณไม่ได้อยู่ในห้อง กรุณาสร้างห้องใหม่หรือเข้าห้องอื่น';

export function isRoomAccessLost(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code).replace(/^(firestore|functions)\//, '') : '';
  return code === 'permission-denied' || code === 'not-found' || code === 'unauthenticated';
}
