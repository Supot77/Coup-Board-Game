import { collection, doc, onSnapshot, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import { auth, db } from './firebase.ts';
import { normalizeRoomCode } from './roomCommands.ts';

export type GameCommand = (
  | { type: 'action'; actionName: string; targetId?: string }
  | { type: 'respond'; response: 'pass' | 'challenge' | 'block'; character?: string; responseWindowId?: string }
  | { type: 'expireResponses'; responseWindowId: string }
  | { type: 'discard'; cardIndex: number }
  | { type: 'exchange'; cardIndexes: number[] }
  | { type: 'surrender' }) & { expectedRoundId?: string; expectedTurnNumber?: number };

function currentUid(uid?: string) {
  const value = uid ?? auth.currentUser?.uid;
  if (!value) throw Object.assign(new Error('กรุณาเข้าสู่ระบบก่อน'), { code: 'unauthenticated' });
  return value;
}

export async function submitGameCommand(
  codeInput: string,
  actorUid: string,
  command: GameCommand,
  database: Firestore = db,
  onAssigned?: (commandId: string) => void,
) {
  const roomCode = normalizeRoomCode(codeInput);
  const uid = currentUid(actorUid);
  const commandRef = doc(collection(database, `rooms/${roomCode}/commands`));
  onAssigned?.(commandRef.id);
  await setDoc(commandRef, { actorUid: uid, payload: command, createdAt: serverTimestamp() });
  return { commandId: commandRef.id };
}

export interface CommandResult {
  actorUid: string;
  ok: boolean;
  message: string;
}

export function waitForCommandResult(
  codeInput: string,
  commandId: string,
  actorUid: string,
  database: Firestore = db,
): Promise<CommandResult> {
  const roomCode = normalizeRoomCode(codeInput);
  const uid = currentUid(actorUid);
  const resultRef = doc(database, `rooms/${roomCode}/commandResults/${commandId}`);
  return new Promise((resolve, reject) => {
    const unsubscribe = onSnapshot(resultRef, snapshot => {
      if (!snapshot.exists()) return;
      const result = snapshot.data() as CommandResult;
      if (result.actorUid !== uid) {
        unsubscribe();
        reject(Object.assign(new Error('ผลคำสั่งไม่ตรงกับผู้เล่นปัจจุบัน'), { code: 'permission-denied' }));
        return;
      }
      unsubscribe();
      if (result.ok) resolve(result);
      else reject(Object.assign(new Error(result.message), { code: 'failed-precondition' }));
    }, error => {
      unsubscribe();
      reject(error);
    });
  });
}
