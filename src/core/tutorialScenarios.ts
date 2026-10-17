import { getActionLabel } from './gameHelp';

export const tutorialRoles = ['Duke', 'Assassin', 'Captain', 'Ambassador', 'Contessa'] as const;
export type TutorialRole = typeof tutorialRoles[number];
export type PracticeCard = { character: string; isDead: boolean };
export type PracticePlayer = { name: string; coins: number; cards: PracticeCard[] };
export type PracticeChange =
  | { kind: 'coins'; actor: number; amount: number }
  | { kind: 'transfer'; from: number; to: number; amount: number }
  | { kind: 'discard'; actor: number }
  | { kind: 'proof'; actor: number; role: string }
  | { kind: 'replace'; actor: number; role: string; replacement: string }
  | { kind: 'exchange'; actor: number; drawn: string[] }
  | { kind: 'decision'; choices: PracticeChoice[] };
export type PracticeStep = { text: string; change?: PracticeChange };
export type PracticeChoice = { id: string; label: string; explanation: string; role?: string; disabledReason?: string; steps: PracticeStep[] };
export type TutorialScenario = { id: string; role: TutorialRole; title: string; situation: string; players: PracticePlayer[]; choices: PracticeChoice[] };

const step = (text: string, change?: PracticeChange): PracticeStep => ({ text, change });
const lose = (actor: number) => step(`${actor === 0 ? 'คุณ' : 'เมย์'} ต้องเลือกเปิดเผยไพ่ 1 ใบ`, { kind: 'discard', actor });
const has = (players: PracticePlayer[], actor: number, role: string) => players[actor].cards.some(card => !card.isDead && card.character === role);
const primaryAction: Record<TutorialRole, string> = { Duke: 'Tax', Assassin: 'Assassinate', Captain: 'Steal', Ambassador: 'Exchange', Contessa: 'Coup' };
const actionRole: Record<string, string> = { Tax: 'Duke', Assassinate: 'Assassin', Steal: 'Captain', Exchange: 'Ambassador' };
const cost = (action: string) => action === 'Assassinate' ? 3 : action === 'Coup' ? 7 : 0;
const blockRoles = (action: string) => action === 'ForeignAid' ? ['Duke'] : action === 'Steal' ? ['Captain', 'Ambassador'] : action === 'Assassinate' ? ['Contessa'] : [];
const proof = (actor: number, role: string): PracticeStep[] => [
  step(`${actor === 0 ? 'คุณ' : 'เมย์'} แสดง ${role} ที่ยังใช้ได้ จึงพิสูจน์บทบาทสำเร็จ`, { kind: 'proof', actor, role }),
  step(`คืน ${role} ที่ใช้พิสูจน์เข้ากอง แล้วรับไพ่ใหม่แทน`, { kind: 'replace', actor, role, replacement: role === 'Captain' ? 'Duke' : 'Captain' }),
];
const resolve = (action: string, actor: number): PracticeStep[] => {
  const name = actor === 0 ? 'คุณ' : 'เมย์';
  if (['Income', 'ForeignAid', 'Tax'].includes(action)) {
    const amount = action === 'Income' ? 1 : action === 'ForeignAid' ? 2 : 3;
    return [step(`${name} ได้รับ ${amount} เหรียญจาก ${getActionLabel(action)}`, { kind: 'coins', actor, amount })];
  }
  if (action === 'Steal') return [step('ขโมยได้สูงสุด 2 เหรียญ ถ้าเป้าหมายมีน้อยกว่า ให้ขโมยเท่าที่มี', { kind: 'transfer', from: 1 - actor, to: actor, amount: 2 })];
  if (action === 'Exchange') return [step('จั่ว 2 ใบ รวมกับไพ่ที่ยังใช้ได้ แล้วเลือกเก็บเท่าจำนวนเดิม', { kind: 'exchange', actor, drawn: ['Captain', 'Contessa'] })];
  return [lose(1 - actor)];
};
const challenge = (players: PracticePlayer[], actor: number, role: string, continuation: PracticeStep[]): PracticeStep[] => has(players, actor, role)
  ? [...proof(actor, role), step('ผู้จับโกหกท้าผิด จึงเสียอิทธิพล 1 ใบ'), lose(1 - actor), ...continuation]
  : [step(`${actor === 0 ? 'คุณ' : 'เมย์'} ไม่มี ${role} ที่ยังใช้ได้ จึงถูกจับโกหกสำเร็จ`), lose(actor), ...continuation];

function disputeAction(players: PracticePlayer[], action: string, actor: number): PracticeStep[] {
  const role = actionRole[action];
  const continuation = has(players, actor, role)
    ? [...(action === 'Assassinate' ? [step('เมื่อจับโกหกผิด การลอบสังหารจะดำเนินต่อหากเป้าหมายยังไม่ตกรอบ ไม่มีรอบเลือกบล็อกใหม่')] : []), ...resolve(action, actor)]
    : [step('แอคชั่นถูกยกเลิก เหรียญที่จ่ายไปแล้วจะไม่คืน')];
  return challenge(players, actor, role, continuation);
}
function disputeBlock(players: PracticePlayer[], action: string, actor: number, role: string): PracticeStep[] {
  const blocker = 1 - actor;
  return challenge(players, blocker, role, has(players, blocker, role)
    ? [step('บล็อกสำเร็จ แอคชั่นเดิมถูกยกเลิก เหรียญที่จ่ายไปแล้วจะไม่คืน')]
    : [step('การบล็อกถูกจับโกหกสำเร็จ จึงกลับไปทำแอคชั่นเดิม'), ...resolve(action, actor)]);
}
const player = (name: string, roles: string[], coins: number): PracticePlayer => ({ name, coins, cards: roles.map(character => ({ character, isDead: false })) });
type Setup = { hand?: string[]; opponent?: string[]; coins?: number; opponentCoins?: number; revealed?: string; reaction?: 'pass' | 'challenge' | 'block'; blockingRole?: string; challengeBlock?: boolean; action?: string };
function setup(role: TutorialRole, config: Setup): PracticePlayer[] {
  const players = [player('คุณ', config.hand || [role, role === 'Duke' ? 'Contessa' : 'Duke'], config.coins ?? 7), player('เมย์', config.opponent || ['Captain', 'Contessa'], config.opponentCoins ?? 4)];
  if (config.revealed) players[0].cards.push({ character: config.revealed, isDead: true });
  return players;
}

function turn(role: TutorialRole, id: string, title: string, config: Setup = {}): TutorialScenario {
  const players = setup(role, config);
  const action = config.action || primaryAction[role];
  const payment = cost(action);
  const before: PracticeStep[] = [step(`คุณเลือก ${getActionLabel(action)}${actionRole[action] ? ` โดยอ้าง ${actionRole[action]}` : ''}`)];
  if (payment) before.push(step(`จ่าย ${payment} เหรียญก่อนรอการตอบโต้`, { kind: 'coins', actor: 0, amount: -payment }));
  let rest = resolve(action, 0);
  if (config.reaction === 'challenge') rest = [step('เมย์กดจับโกหกบทบาทที่คุณอ้าง'), ...disputeAction(players, action, 0)];
  else if (config.reaction === 'block') {
    const blockingRole = config.blockingRole!;
    rest = [step(`เมย์อ้าง ${blockingRole} เพื่อบล็อก คุณจะตอบอย่างไร?`, { kind: 'decision', choices: [
      { id: 'accept', label: 'ยอมรับการบล็อก', explanation: 'จบแอคชั่นนี้ เหรียญที่จ่ายไปแล้วจะไม่คืน', steps: [step('คุณยอมรับการบล็อก แอคชั่นถูกยกเลิก')] },
      { id: 'challenge-block', label: 'จับโกหกการบล็อก', explanation: `ขอตรวจว่าเมย์มี ${blockingRole} จริงหรือไม่ ถ้าเมย์มี คุณต้องเสียไพ่ 1 ใบ`, steps: disputeBlock(players, action, 0, blockingRole) },
    ] })];
  } else if (action !== 'Income' && action !== 'Coup') rest = [step('เมย์ปล่อยผ่าน ไม่มีผู้เล่นอื่นบล็อกหรือจับโกหก'), ...rest];
  const disabledReason = players[0].coins < payment ? `ต้องมีอย่างน้อย ${payment} เหรียญ` : undefined;
  const choices: PracticeChoice[] = [{ id: 'use', label: `ใช้ ${getActionLabel(action)}`, role: actionRole[action], explanation: actionRole[action] && !has(players, 0, actionRole[action]) ? `คุณไม่มี ${actionRole[action]} ที่ยังใช้ได้ การเลือกนี้คือสวมบทบาท` : 'เริ่มแอคชั่นแล้วดูการตอบโต้ทีละขั้น', disabledReason, steps: [...before, ...rest] }];
  choices.push({ id: 'income', label: 'ใช้ Income', explanation: 'รับ 1 เหรียญโดยไม่อ้างบทบาท', disabledReason: players[0].coins >= 10 ? 'มีตั้งแต่ 10 เหรียญ ต้องเลือก Coup' : undefined, steps: resolve('Income', 0) });
  return { id, role, title, situation: `ตาของคุณ คุณมี ${players[0].coins} เหรียญ ${config.reaction === 'challenge' ? 'ในเส้นทางนี้ เมย์จะจับโกหกแอคชั่นประจำบทบาทของคุณ' : config.reaction === 'block' ? 'ในเส้นทางนี้ เมย์จะบล็อก แล้วให้คุณเลือกยอมรับหรือจับโกหก' : action === 'Coup' ? 'Coup บล็อกและจับโกหกไม่ได้ เป้าหมายต้องเปิดเผยไพ่' : 'ในเส้นทางนี้ เมย์จะปล่อยผ่าน'} ลองกดแอคชั่นเพื่อดูผล`, players, choices };
}

function defend(role: TutorialRole, id: string, title: string, action: string, config: Setup = {}): TutorialScenario {
  const players = setup(role, { ...config, opponent: config.opponent || (action === 'Assassinate' ? ['Assassin', 'Captain'] : undefined) });
  players[1].coins -= cost(action);
  const continuation = resolve(action, 1);
  const choices: PracticeChoice[] = [{ id: 'pass', label: 'ปล่อยผ่าน', explanation: 'ยอมให้แอคชั่นดำเนินต่อ ดูว่าจะเสียเงินหรือไพ่เท่าใด', steps: [step('คุณปล่อยผ่าน ผู้เล่นที่เหลือยอมรับด้วย'), ...continuation] }];
  for (const blockingRole of blockRoles(action)) choices.push({ id: `block-${blockingRole}`, label: `บล็อกด้วย ${blockingRole}`, role: blockingRole, explanation: has(players, 0, blockingRole) ? `คุณมี ${blockingRole} ที่ยังใช้ได้` : `คุณต้องสวมบทบาท ${blockingRole} เพราะไม่มีไพ่ที่ยังใช้ได้`, steps: [
    step(`คุณอ้าง ${blockingRole} เพื่อบล็อก ${getActionLabel(action)}`),
    ...(config.challengeBlock ? [step('เมย์จับโกหกการบล็อกของคุณ'), ...disputeBlock(players, action, 1, blockingRole)] : [step('เมย์ยอมรับการบล็อก แอคชั่นถูกยกเลิก เหรียญที่เมย์จ่ายไปแล้วจะไม่คืน')]),
  ] });
  if (actionRole[action]) choices.push({ id: 'challenge', label: `จับโกหก ${getActionLabel(action)}`, explanation: `ตรวจว่าเมย์มี ${actionRole[action]} จริงหรือไม่ ไพ่ของคุณบอกไพ่ในมือเมย์ไม่ได้`, steps: [step(`คุณจับโกหกบทบาท ${actionRole[action]} ที่เมย์อ้าง`), ...disputeAction(players, action, 1)] });
  choices.push({ id: 'timeout', label: 'ลองกรณีไม่ตอบจนหมดเวลา', explanation: 'เกมจริงให้เวลาตอบ 15 วินาที บทเรียนนี้กดเพื่อข้ามไปดูผลได้เลย', steps: [step('หมดเวลา 15 วินาที ระบบเลือกปล่อยผ่านให้คุณ'), ...continuation] });
  if (action === 'Coup') return { id, role, title, situation: 'เมย์ใช้ Coup กับคุณและจ่าย 7 เหรียญแล้ว คุณต้องเปิดเผยไพ่ 1 ใบ ไม่มีช่วงบล็อก จับโกหก หรือรอให้หมดเวลาตอบ', players, choices: [
    { id: 'reveal', label: 'เลือกไพ่ที่จะเปิดเผย', explanation: 'Contessa หยุด Coup ไม่ได้ ต้องเสียอิทธิพล 1 ใบ', steps: [lose(0)] },
  ] };
  return { id, role, title, situation: `เมย์ใช้ ${getActionLabel(action)}${actionRole[action] ? ` โดยอ้าง ${actionRole[action]}` : ''}${action === 'ForeignAid' ? ' เพื่อรับ 2 เหรียญ' : ' กับคุณ'}${cost(action) ? ` และจ่าย ${cost(action)} เหรียญไปแล้ว` : ''} คุณกำลังเลือกวิธีตอบโต้${config.challengeBlock ? ' หากคุณบล็อก เมย์จะจับโกหก' : ' หากคุณบล็อก เมย์จะยอมรับ'} ไพ่คว่ำของเมย์ยังเป็นความลับ`, players, choices };
}

export const tutorialScenarios: TutorialScenario[] = [
  turn('Duke', 'duke-tax', 'Tax เมื่อทุกคนปล่อยผ่าน'),
  turn('Duke', 'duke-proof', 'มี Duke จริงแล้วถูกจับโกหก', { reaction: 'challenge' }),
  turn('Duke', 'duke-bluff', 'สวมบทบาท Duke แล้วถูกจับโกหก', { hand: ['Captain', 'Contessa'], reaction: 'challenge' }),
  defend('Duke', 'duke-block', 'บล็อก Foreign Aid ด้วย Duke', 'ForeignAid'),
  defend('Duke', 'duke-block-proof', 'บล็อกจริงแล้วถูกจับโกหก', 'ForeignAid', { challengeBlock: true }),
  defend('Duke', 'duke-block-bluff', 'สวมบทบาทเพื่อบล็อก Foreign Aid', 'ForeignAid', { hand: ['Captain', 'Contessa'], challengeBlock: true }),
  turn('Duke', 'duke-coup', 'มี 10 เหรียญ ต้องใช้ Coup', { action: 'Coup', coins: 10 }),

  turn('Assassin', 'assassin-hit', 'จ่าย 3 เหรียญเพื่อลอบสังหาร'),
  turn('Assassin', 'assassin-proof', 'ถูกจับโกหกแล้วการลอบสังหารดำเนินต่อ', { reaction: 'challenge', opponent: ['Captain', 'Duke'] }),
  turn('Assassin', 'assassin-bluff', 'สวมบทบาท Assassin แล้วถูกจับโกหก', { hand: ['Captain', 'Duke'], reaction: 'challenge' }),
  turn('Assassin', 'assassin-block-true', 'เป้าหมายบล็อกด้วย Contessa จริง', { reaction: 'block', blockingRole: 'Contessa' }),
  turn('Assassin', 'assassin-block-false', 'เป้าหมายอ้าง Contessa ที่ไม่มี', { reaction: 'block', blockingRole: 'Contessa', opponent: ['Captain', 'Duke'] }),
  turn('Assassin', 'assassin-poor', 'มีไม่ถึง 3 เหรียญ ยังลอบสังหารไม่ได้', { coins: 2 }),
  turn('Assassin', 'assassin-one-card', 'เป้าหมายเหลือใบเดียวแล้วจับโกหกผิด', { opponent: ['Captain'], reaction: 'challenge' }),

  turn('Captain', 'captain-steal', 'ขโมย 2 เหรียญเมื่อไม่มีใครหยุด'),
  turn('Captain', 'captain-one-coin', 'เป้าหมายมีเพียง 1 เหรียญ', { opponentCoins: 1 }),
  turn('Captain', 'captain-no-coins', 'เป้าหมายไม่มีเหรียญให้ขโมย', { opponentCoins: 0 }),
  turn('Captain', 'captain-proof', 'มี Captain จริงแล้วถูกจับโกหก', { reaction: 'challenge' }),
  turn('Captain', 'captain-bluff', 'สวมบทบาท Captain แล้วถูกจับโกหก', { hand: ['Duke', 'Contessa'], reaction: 'challenge' }),
  turn('Captain', 'captain-block-captain', 'เป้าหมายบล็อกด้วย Captain', { reaction: 'block', blockingRole: 'Captain' }),
  turn('Captain', 'captain-block-ambassador', 'เป้าหมายบล็อกด้วย Ambassador ที่ไม่มี', { reaction: 'block', blockingRole: 'Ambassador' }),
  defend('Captain', 'captain-defend', 'ถูกขโมยแล้วเลือกบล็อกหรือจับโกหก', 'Steal', { opponent: ['Captain', 'Contessa'], challengeBlock: true }),

  turn('Ambassador', 'ambassador-exchange', 'จั่ว 2 ใบแล้วเลือกเก็บ 2 ใบ'),
  turn('Ambassador', 'ambassador-one-card', 'เหลือไพ่ที่ใช้ได้ใบเดียว เลือกเก็บ 1 ใบ', { hand: ['Ambassador'], revealed: 'Duke' }),
  turn('Ambassador', 'ambassador-proof', 'พิสูจน์ Ambassador แล้วจึงสลับไพ่', { reaction: 'challenge' }),
  turn('Ambassador', 'ambassador-bluff', 'สวมบทบาท Ambassador แล้วถูกจับโกหก', { hand: ['Duke', 'Contessa'], reaction: 'challenge' }),
  defend('Ambassador', 'ambassador-block', 'บล็อกการขโมยด้วย Ambassador', 'Steal'),
  defend('Ambassador', 'ambassador-block-proof', 'มี Ambassador จริงแล้วถูกจับโกหกการบล็อก', 'Steal', { challengeBlock: true }),
  defend('Ambassador', 'ambassador-block-bluff', 'Ambassador เปิดเผยไปแล้ว ใช้ยืนยันไม่ได้', 'Steal', { hand: ['Duke'], revealed: 'Ambassador', challengeBlock: true }),

  defend('Contessa', 'contessa-block', 'บล็อกการลอบสังหารด้วย Contessa', 'Assassinate'),
  defend('Contessa', 'contessa-proof', 'บล็อกจริงแล้วถูกจับโกหก', 'Assassinate', { challengeBlock: true }),
  defend('Contessa', 'contessa-bluff', 'สวม Contessa แล้วอาจเสียไพ่ 2 ใบ', 'Assassinate', { hand: ['Captain', 'Duke'], challengeBlock: true }),
  defend('Contessa', 'contessa-last-card', 'บล็อกปลอมขณะเหลือใบเดียว', 'Assassinate', { hand: ['Duke'], revealed: 'Captain', challengeBlock: true }),
  defend('Contessa', 'contessa-fake-assassin', 'จับโกหกผู้ลอบสังหารที่ไม่มี Assassin', 'Assassinate', { opponent: ['Captain', 'Duke'] }),
  defend('Contessa', 'contessa-coup', 'ถือ Contessa ก็หยุด Coup ไม่ได้', 'Coup', { opponentCoins: 10 }),
];
