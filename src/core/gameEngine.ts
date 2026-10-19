import type { PlayerAvatarId } from '../types';
import { responseDeadlineMillis } from './responseTiming.ts';

export type Role = 'Duke' | 'Assassin' | 'Captain' | 'Ambassador' | 'Contessa';
export type Card = { character: Role; isDead: boolean; id: string };
export type PublicPlayer = {
  name: string;
  coins: number;
  isDead: boolean;
  influenceCount: number;
  revealedCards: { slot: number; character: Role }[];
  isReady?: boolean;
  avatarId?: PlayerAvatarId;
};
export type PrivatePlayer = { cards: Card[]; exchangeOptions: Card[] };
export type PendingAction = {
  actionName: string;
  sourceId: string;
  targetId: string | null;
  blockerId: string | null;
  blockCharacter: Role | null;
};
export type Room = Record<string, any> & {
  adminId: string;
  status: 'lobby' | 'playing';
  gameState: string;
  turnOrder?: string[];
  currentTurnIndex?: number;
  passVotes?: string[];
  pendingAction?: PendingAction | null;
  actionLog?: string;
  responseStartedAt?: unknown;
  responseTimeoutSeconds?: number;
};
export type Aggregate = {
  room: Room;
  players: Record<string, PublicPlayer>;
  privatePlayers: Record<string, PrivatePlayer>;
  deck: Role[];
  now: number;
};
export type Command = (
  | { type: 'action'; actionName: string; targetId?: string }
  | { type: 'respond'; response: 'pass' | 'challenge' | 'block'; character?: Role; responseWindowId?: string }
  | { type: 'expireResponses'; responseWindowId: string }
  | { type: 'discard'; cardIndex: number }
  | { type: 'exchange'; cardIndexes: number[] }
  | { type: 'surrender' }) & { expectedRoundId?: string; expectedTurnNumber?: number };

export class GameRuleError extends Error {
  public code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const roles: Role[] = ['Duke', 'Assassin', 'Captain', 'Ambassador', 'Contessa'];
const actionRole: Record<string, Role> = {
  Tax: 'Duke', Assassinate: 'Assassin', Steal: 'Captain', Exchange: 'Ambassador',
};
const cardsOf = (state: Aggregate, uid: string) => state.privatePlayers[uid]?.cards ?? [];
const living = (state: Aggregate, uid: string) => Boolean(state.players[uid] && !state.players[uid].isDead);
const aliveIds = (state: Aggregate) => Object.keys(state.players).filter(uid => living(state, uid));

function reject(code: string, message: string): never { throw new GameRuleError(code, message); }
function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function clearResponse(state: Aggregate) {
  state.room.pendingAction = null;
  state.room.passVotes = [];
  state.room.discardTarget = null;
  state.room.afterDiscardState = null;
  state.room.afterDiscardPayload = null;
  state.room.responseStartedAt = null;
  state.room.responseWindowId = null;
}
function openResponseWindow(state: Aggregate) {
  const sequence = (state.room.responseSequence ?? 0) + 1;
  state.room.responseSequence = sequence;
  state.room.responseWindowId = `${state.room.roundId ?? 'legacy'}:${sequence}`;
  state.room.responseStartedAt = state.now;
}
function finishIfWon(state: Aggregate) {
  const alive = aliveIds(state);
  if (alive.length <= 1 && Object.keys(state.players).length > 1) {
    state.room.gameState = 'game_over';
    state.room.winner = alive[0] ?? null;
    state.room.gameEndedAt = state.now;
    state.room.actionLog = alive[0]
      ? `${state.players[alive[0]].name} เป็นผู้ชนะ เหลืออิทธิพลเป็นคนสุดท้าย`
      : 'ไม่มีผู้เล่นเหลืออยู่ เกมจบแล้ว';
    clearResponse(state);
    return true;
  }
  return false;
}
function endTurn(state: Aggregate, message: string) {
  if (finishIfWon(state)) return;
  const order = state.room.turnOrder ?? [];
  if (!order.length) reject('failed-precondition', 'ไม่พบลำดับผู้เล่น');
  let next = state.room.currentTurnIndex ?? 0;
  for (let i = 0; i < order.length; i++) {
    next = (next + 1) % order.length;
    if (living(state, order[next])) break;
  }
  state.room.currentTurnIndex = next;
  state.room.turnNumber = (state.room.turnNumber ?? 1) + 1;
  state.room.gameState = 'waiting_for_action';
  state.room.actionLog = message;
  clearResponse(state);
}
function beginDiscard(state: Aggregate, uid: string, message: string, after: 'end_turn' | 'resolve_action', payload: PendingAction | null = null) {
  if (!living(state, uid)) return after === 'resolve_action' && payload ? resolveAction(state, payload) : endTurn(state, message);
  state.room.gameState = 'waiting_for_discard';
  state.room.discardTarget = uid;
  state.room.afterDiscardState = after;
  state.room.afterDiscardPayload = payload;
  state.room.actionLog = message;
  state.room.passVotes = [];
  state.room.responseStartedAt = null;
  state.room.responseWindowId = null;
}
function loseInfluence(state: Aggregate, uid: string, cardIndex: number) {
  const cards = cardsOf(state, uid);
  if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= cards.length || cards[cardIndex].isDead) {
    reject('invalid-argument', 'เลือกไพ่ที่ยังใช้ได้');
  }
  cards[cardIndex].isDead = true;
  const player = state.players[uid];
  player.revealedCards = [...player.revealedCards, { slot: cardIndex, character: cards[cardIndex].character }];
  player.influenceCount = cards.filter(card => !card.isDead).length;
  player.isDead = player.influenceCount === 0;
}
function resolveAction(state: Aggregate, pending: PendingAction) {
  if (pending.blockerId && state.room.ignoreBlock !== true) {
    endTurn(state, `ทุกคนยอมรับการบล็อก ${state.players[pending.blockerId]?.name ?? ''} แอคชั่นจึงถูกยกเลิก`);
    return;
  }
  state.room.ignoreBlock = false;
  if (pending.targetId && !living(state, pending.targetId)) {
    endTurn(state, 'เป้าหมายตกรอบแล้ว จึงข้ามแอคชั่นนี้');
    return;
  }
  const source = state.players[pending.sourceId];
  if (!source || source.isDead) { endTurn(state, 'ผู้ใช้แอคชั่นตกรอบแล้ว จบตานี้'); return; }
  if (pending.actionName === 'ForeignAid') {
    source.coins += 2;
    endTurn(state, `${source.name} ใช้ Foreign Aid ได้รับ 2 เหรียญ`);
  } else if (pending.actionName === 'Tax') {
    source.coins += 3;
    endTurn(state, `${source.name} ใช้ Tax ได้รับ 3 เหรียญ`);
  } else if (pending.actionName === 'Steal') {
    const target = state.players[pending.targetId!];
    const amount = Math.min(2, target.coins);
    target.coins -= amount;
    source.coins += amount;
    endTurn(state, `${source.name} ขโมย ${amount} เหรียญจาก ${target.name}`);
  } else if (pending.actionName === 'Assassinate') {
    beginDiscard(state, pending.targetId!, `${source.name} ลอบสังหารสำเร็จ เป้าหมายต้องเปิดเผยไพ่ 1 ใบ`, 'end_turn');
  } else if (pending.actionName === 'Exchange') {
    const deck = state.deck;
    if (deck.length < 2) reject('failed-precondition', 'กองไพ่มีไม่พอสำหรับ Exchange');
    const options = cardsOf(state, pending.sourceId).filter(card => !card.isDead);
    options.push(...deck.splice(0, 2).map((character, index) => ({ character, isDead: false, id: `exchange-${state.now}-${index}` })));
    state.privatePlayers[pending.sourceId].exchangeOptions = options;
    state.room.gameState = 'waiting_for_exchange';
    state.room.responseStartedAt = null;
    state.room.responseWindowId = null;
    state.room.actionLog = `${source.name} ใช้ Exchange กำลังเลือกไพ่ที่จะเก็บ`;
    state.room.passVotes = [];
  } else {
    reject('failed-precondition', 'แอคชั่นนี้ไม่สามารถดำเนินการต่อได้');
  }
}
function activeResponderIds(state: Aggregate, isBlock: boolean) {
  const pending = state.room.pendingAction as PendingAction;
  return aliveIds(state).filter(uid => uid !== (isBlock ? pending.blockerId : pending.sourceId));
}
function allResponded(state: Aggregate, isBlock: boolean) {
  const responders = activeResponderIds(state, isBlock);
  return responders.every(uid => (state.room.passVotes ?? []).includes(uid));
}
function startResponses(state: Aggregate, action: PendingAction, message: string) {
  state.room.pendingAction = action;
  state.room.gameState = 'waiting_for_responses';
  state.room.passVotes = [];
  state.room.actionLog = message;
  openResponseWindow(state);
}
function applyResponse(state: Aggregate, actor: string, command: Extract<Command, { type: 'respond' }>) {
  const phase = state.room.gameState;
  const blocking = phase === 'waiting_for_block_responses';
  if (phase !== 'waiting_for_responses' && !blocking) reject('failed-precondition', 'ตอนนี้ไม่มีเหตุการณ์ให้ตอบสนอง');
  if (state.room.responseWindowId && command.responseWindowId !== state.room.responseWindowId) {
    reject('failed-precondition', 'เหตุการณ์เปลี่ยนแล้ว กรุณาดูเหตุการณ์ล่าสุด');
  }
  const deadline = responseDeadlineMillis(state.room);
  if (deadline !== null && state.now >= deadline) reject('failed-precondition', 'หมดเวลาตอบเหตุการณ์นี้แล้ว กำลังดำเนินเกมต่อ');
  const pending = state.room.pendingAction as PendingAction;
  const excluded = blocking ? pending.blockerId : pending.sourceId;
  if (actor === excluded || !living(state, actor)) reject('permission-denied', 'คุณไม่มีสิทธิ์ตอบสนองเหตุการณ์นี้');
  if ((state.room.passVotes ?? []).includes(actor)) reject('failed-precondition', 'คุณตอบเหตุการณ์นี้ไปแล้ว');

  if (command.response === 'pass') {
    state.room.passVotes = [...(state.room.passVotes ?? []), actor];
    if (allResponded(state, blocking)) {
      if (blocking) endTurn(state, `ทุกคนยอมรับการบล็อก แอคชั่นนี้ถูกยกเลิก`);
      else resolveAction(state, pending);
    }
    return;
  }

  if (command.response === 'block') {
    if (blocking) reject('failed-precondition', 'มีผู้เล่นบล็อกเหตุการณ์นี้แล้ว');
    const character = command.character;
    let valid = false;
    if (pending.actionName === 'ForeignAid') valid = character === 'Duke';
    if (pending.targetId === actor && pending.actionName === 'Assassinate') valid = character === 'Contessa';
    if (pending.targetId === actor && pending.actionName === 'Steal') valid = character === 'Captain' || character === 'Ambassador';
    if (!valid) reject('permission-denied', 'บทบาทนี้ใช้บล็อกเหตุการณ์นี้ไม่ได้');
    state.room.pendingAction = { ...pending, blockerId: actor, blockCharacter: character! };
    state.room.gameState = 'waiting_for_block_responses';
    state.room.passVotes = [];
    state.room.actionLog = `${state.players[actor].name} อ้าง ${character} เพื่อบล็อกแอคชั่น`;
    openResponseWindow(state);
    return;
  }

  if (command.response === 'challenge') {
    const claimantId = blocking ? pending.blockerId! : pending.sourceId;
    const claimedRole = blocking ? pending.blockCharacter : actionRole[pending.actionName];
    if (!claimedRole) reject('failed-precondition', 'แอคชั่นนี้ไม่ได้อ้างบทบาท จึงจับโกหกไม่ได้');
    const hasRole = cardsOf(state, claimantId).some(card => !card.isDead && card.character === claimedRole);
    if (hasRole) {
      if (!state.deck.length) reject('failed-precondition', 'กองไพ่หมด ไม่สามารถจั่วไพ่ทดแทนได้');
      const cards = cardsOf(state, claimantId);
      const proof = cards.find(card => !card.isDead && card.character === claimedRole)!;
      const proofIndex = cards.indexOf(proof);
      const replacement = state.deck.pop()!;
      cards[proofIndex] = { character: replacement, isDead: false, id: `proof-${state.now}` };
      state.deck = shuffle([...state.deck, claimedRole]);
      const message = `${state.players[claimantId].name} มี ${claimedRole} จริง ผู้ท้าต้องเปิดเผยไพ่ 1 ใบ`;
      beginDiscard(state, actor, message, blocking ? 'end_turn' : 'resolve_action', blocking ? null : pending);
    } else {
      const message = `${state.players[claimantId].name} ไม่มี ${claimedRole} จึงต้องเปิดเผยไพ่ 1 ใบ`;
      const continuation = blocking ? { ...pending, blockerId: null, blockCharacter: null } : null;
      if (blocking) state.room.ignoreBlock = true;
      beginDiscard(state, claimantId, message, blocking ? 'resolve_action' : 'end_turn', continuation);
    }
    return;
  }
}

function allowedAction(state: Aggregate, actor: string) {
  if (state.room.gameState !== 'waiting_for_action') reject('failed-precondition', 'ยังไม่ถึงช่วงเลือกแอคชั่น');
  const order = state.room.turnOrder ?? [];
  if (order[state.room.currentTurnIndex ?? 0] !== actor) reject('permission-denied', 'ยังไม่ถึงตาของคุณ');
  if (!living(state, actor)) reject('permission-denied', 'ผู้เล่นที่ตกรอบแล้วทำแอคชั่นไม่ได้');
}
function applyAction(state: Aggregate, actor: string, command: Extract<Command, { type: 'action' }>) {
  allowedAction(state, actor);
  const player = state.players[actor];
  const { actionName, targetId } = command;
  const supported = ['Income', 'ForeignAid', 'Coup', 'Tax', 'Assassinate', 'Steal', 'Exchange'];
  if (!supported.includes(actionName)) reject('invalid-argument', 'ไม่รู้จักแอคชั่นนี้');
  if (player.coins >= 10 && actionName !== 'Coup') reject('failed-precondition', 'มี 10 เหรียญขึ้นไป ต้องเลือก Coup');
  if (actionName === 'Coup' && player.coins < 7) reject('failed-precondition', 'ต้องมีอย่างน้อย 7 เหรียญเพื่อใช้ Coup');
  if (actionName === 'Assassinate' && player.coins < 3) reject('failed-precondition', 'ต้องมีอย่างน้อย 3 เหรียญเพื่อใช้ Assassinate');
  state.room.currentActionId = `${state.room.roundId ?? 'legacy'}:turn:${state.room.turnNumber ?? 1}`;

  if (actionName === 'Income') { player.coins += 1; endTurn(state, `${player.name} ใช้ Income ได้รับ 1 เหรียญ`); return; }
  if (actionName === 'Coup' || actionName === 'Assassinate' || actionName === 'Steal') {
    if (!targetId || targetId === actor || !living(state, targetId)) reject('invalid-argument', 'เลือกเป้าหมายที่ยังอยู่ในเกม');
  }
  if (actionName === 'Coup') {
    player.coins -= 7;
    beginDiscard(state, targetId!, `${player.name} ใช้ Coup กับ ${state.players[targetId!].name} เป้าหมายต้องเปิดเผยไพ่ 1 ใบ`, 'end_turn');
    return;
  }
  if (actionName === 'Assassinate') player.coins -= 3;
  const targetName = targetId ? ` กับ ${state.players[targetId].name}` : '';
  startResponses(state, { actionName, sourceId: actor, targetId: targetId ?? null, blockerId: null, blockCharacter: null }, `${player.name} ใช้ ${actionName}${targetName}`);
  if (aliveIds(state).length === 1) finishIfWon(state);
}

export function applyGameCommand(state: Aggregate, actor: string, command: Command): Aggregate {
  if (!state.players[actor]) reject('permission-denied', 'คุณไม่ได้อยู่ในห้องนี้');
  if ((command.expectedRoundId && command.expectedRoundId !== state.room.roundId)
    || (command.expectedTurnNumber !== undefined && command.expectedTurnNumber !== (state.room.turnNumber ?? 1))) {
    reject('failed-precondition', 'รอบหรือตาเปลี่ยนแล้ว กรุณาเลือกจากสถานะล่าสุด');
  }
  if (state.room.status !== 'playing' && command.type !== 'surrender') reject('failed-precondition', 'เกมยังไม่เริ่ม');
  if (command.type === 'expireResponses') {
    if (actor !== state.room.adminId) reject('permission-denied', 'เฉพาะเจ้าของห้องดำเนินการหมดเวลาได้');
    const blocking = state.room.gameState === 'waiting_for_block_responses';
    if ((!blocking && state.room.gameState !== 'waiting_for_responses') || command.responseWindowId !== state.room.responseWindowId) {
      reject('failed-precondition', 'เหตุการณ์เปลี่ยนแล้ว');
    }
    const deadline = responseDeadlineMillis(state.room);
    if (deadline === null || state.now < deadline) reject('failed-precondition', 'ยังไม่หมดเวลาตอบโต้');
    state.room.passVotes = activeResponderIds(state, blocking);
    if (blocking) endTurn(state, 'หมดเวลาตอบโต้ ยอมรับการบล็อกและจบตา');
    else resolveAction(state, state.room.pendingAction as PendingAction);
  } else if (command.type === 'action') applyAction(state, actor, command);
  else if (command.type === 'respond') applyResponse(state, actor, command);
  else if (command.type === 'discard') {
    if (state.room.gameState !== 'waiting_for_discard' || state.room.discardTarget !== actor) reject('permission-denied', 'ตอนนี้คุณไม่มีไพ่ที่ต้องเปิดเผย');
    loseInfluence(state, actor, command.cardIndex);
    const after = state.room.afterDiscardState;
    const payload = state.room.afterDiscardPayload as PendingAction | null;
    const message = state.room.actionLog ?? 'เปิดเผยไพ่แล้ว';
    if (finishIfWon(state)) return state;
    if (after === 'resolve_action' && payload) {
      if (state.room.ignoreBlock) {
        state.room.ignoreBlock = false;
        const resumed = { ...payload, blockerId: null, blockCharacter: null };
        resolveAction(state, resumed);
      } else resolveAction(state, payload);
    } else endTurn(state, 'เปิดเผยไพ่แล้ว เริ่มตาของผู้เล่นคนถัดไป');
    void message;
  } else if (command.type === 'exchange') {
    if (state.room.gameState !== 'waiting_for_exchange' || state.room.turnOrder?.[state.room.currentTurnIndex ?? 0] !== actor) reject('permission-denied', 'ตอนนี้คุณไม่ได้เลือกไพ่ Exchange');
    const options = state.privatePlayers[actor].exchangeOptions ?? [];
    const liveCount = cardsOf(state, actor).filter(card => !card.isDead).length;
    const indexes = command.cardIndexes;
    if (!Array.isArray(indexes) || indexes.length !== liveCount || new Set(indexes).size !== indexes.length
      || indexes.some(index => !Number.isInteger(index) || index < 0 || index >= options.length)) {
      reject('invalid-argument', `เลือกไพ่ ${liveCount} ใบที่ต้องการเก็บ`);
    }
    const kept = indexes.map(index => options[index]);
    const returned = options.filter((_, index) => !indexes.includes(index)).map(card => card.character);
    const dead = cardsOf(state, actor).filter(card => card.isDead);
    state.privatePlayers[actor].cards = [...kept, ...dead];
    state.players[actor].revealedCards = dead.map((card, index) => ({ slot: kept.length + index, character: card.character }));
    state.privatePlayers[actor].exchangeOptions = [];
    state.deck = shuffle([...state.deck, ...returned]);
    endTurn(state, `${state.players[actor].name} เลือกไพ่จาก Exchange เสร็จแล้ว`);
  } else if (command.type === 'surrender') {
    if (state.room.gameState === 'waiting_for_discard' || state.room.gameState === 'waiting_for_exchange') reject('failed-precondition', 'ทำรายการไพ่ที่ค้างอยู่ให้เสร็จก่อนออกจากเกม');
    if (!living(state, actor)) reject('failed-precondition', 'คุณตกรอบแล้ว');
    const cards = cardsOf(state, actor);
    for (const card of cards) if (!card.isDead) loseInfluence(state, actor, cards.indexOf(card));
    if (finishIfWon(state)) return state;
    const pending = state.room.pendingAction as PendingAction | null;
    if (state.room.gameState === 'waiting_for_action' && state.room.turnOrder?.[state.room.currentTurnIndex ?? 0] === actor) {
      endTurn(state, `${state.players[actor].name} ยอมแพ้`);
    } else if (state.room.gameState === 'waiting_for_responses' && pending?.sourceId === actor) {
      endTurn(state, 'ผู้ใช้แอคชั่นยอมแพ้ ยกเลิกเหตุการณ์');
    } else if (state.room.gameState === 'waiting_for_block_responses' && pending?.blockerId === actor) {
      resolveAction(state, { ...pending, blockerId: null, blockCharacter: null });
    } else {
      if (state.room.gameState === 'waiting_for_responses' || state.room.gameState === 'waiting_for_block_responses') {
        if (allResponded(state, state.room.gameState === 'waiting_for_block_responses')) {
          if (state.room.gameState === 'waiting_for_block_responses') endTurn(state, 'ทุกคนยอมรับการบล็อก แอคชั่นนี้ถูกยกเลิก');
          else resolveAction(state, pending!);
        }
      }
      state.room.actionLog = `${state.players[actor].name} ยอมแพ้`;
    }
  }
  return state;
}

export function createInitialDeck(): Role[] {
  return shuffle(roles.flatMap(role => [role, role, role]));
}

export function isIdleExempt(room: Room, uid: string, players: Record<string, PublicPlayer>): boolean {
  if (room.status !== 'playing' || room.gameState === 'game_over') return false;
  if (room.gameState === 'waiting_for_action') return room.turnOrder?.[room.currentTurnIndex ?? 0] !== uid;
  if (room.gameState === 'waiting_for_discard') return room.discardTarget !== uid;
  if (room.gameState === 'waiting_for_exchange') return room.turnOrder?.[room.currentTurnIndex ?? 0] !== uid;
  if (room.gameState === 'waiting_for_responses' || room.gameState === 'waiting_for_block_responses') {
    const pending = room.pendingAction as PendingAction | null;
    if (!pending || players[uid]?.isDead) return true;
    const excluded = room.gameState === 'waiting_for_block_responses' ? pending.blockerId : pending.sourceId;
    return uid === excluded || (room.passVotes ?? []).includes(uid);
  }
  return false;
}
