export const actionHelp = [
  { name: 'Income', label: 'Income', role: 'ทั่วไป', description: 'รับ 1 เหรียญ', cost: 0, response: 'ไม่มีใครบล็อกหรือจับโกหกได้' },
  { name: 'ForeignAid', label: 'Foreign Aid', role: 'ทั่วไป', description: 'รับ 2 เหรียญ', cost: 0, response: 'ผู้เล่นอื่นอ้าง Duke เพื่อบล็อกได้' },
  { name: 'Coup', label: 'Coup', role: 'ทั่วไป', description: 'จ่าย 7 เหรียญ ให้เป้าหมายเปิดเผยไพ่ 1 ใบ', cost: 7, response: 'ไม่มีใครบล็อกหรือจับโกหกได้' },
  { name: 'Tax', label: 'Tax', role: 'Duke', description: 'รับ 3 เหรียญ', cost: 0, response: 'บล็อกไม่ได้ แต่ผู้เล่นอื่นจับโกหกได้' },
  { name: 'Assassinate', label: 'Assassinate', role: 'Assassin', description: 'จ่าย 3 เหรียญ ให้เป้าหมายเปิดเผยไพ่ 1 ใบ', cost: 3, response: 'เป้าหมายอ้าง Contessa เพื่อบล็อกได้ แม้ถูกบล็อกก็เสีย 3 เหรียญ' },
  { name: 'Steal', label: 'Steal', role: 'Captain', description: 'ขโมยจากเป้าหมายได้สูงสุด 2 เหรียญ', cost: 0, response: 'เป้าหมายอ้าง Captain หรือ Ambassador เพื่อบล็อกได้' },
  { name: 'Exchange', label: 'Exchange', role: 'Ambassador', description: 'จั่ว 2 ใบ แล้วเลือกเก็บเท่าจำนวนไพ่ที่ยังใช้ได้', cost: 0, response: 'คืนไพ่ที่ไม่เลือกเข้ากอง ไพ่ที่เปิดเผยแล้วจะไม่ถูกสลับ' },
];

export const roleHelp: Record<string, { action: string; defence: string }> = {
  Duke: { action: 'ใช้ Tax เพื่อรับ 3 เหรียญ', defence: 'บล็อก Foreign Aid ของผู้เล่นคนใดก็ได้' },
  Assassin: { action: 'ใช้ Assassinate โดยจ่าย 3 เหรียญ ให้เป้าหมายเปิดเผยไพ่ 1 ใบ', defence: 'ไม่มีความสามารถบล็อก' },
  Captain: { action: 'ใช้ Steal เพื่อขโมยได้สูงสุด 2 เหรียญ', defence: 'บล็อก Steal เมื่อคุณถูกขโมย' },
  Ambassador: { action: 'ใช้ Exchange เพื่อจั่ว 2 ใบ แล้วเลือกสลับกับไพ่ที่ยังใช้ได้', defence: 'บล็อก Steal เมื่อคุณถูกขโมย' },
  Contessa: { action: 'ใช้สำหรับบล็อก ไม่มีแอคชั่นประจำบทบาทในตาของคุณ', defence: 'บล็อก Assassinate เมื่อคุณเป็นเป้าหมาย' },
};

export function getActionLabel(name: string) {
  return actionHelp.find(action => action.name === name)?.label || name;
}

export function getLivingRoles(cards: { character: string; isDead: boolean }[] = [], isDead = false) {
  return new Set(isDead ? [] : cards.filter(card => !card.isDead).map(card => card.character));
}

export function getPassConsequence(action: string, blocking: boolean, isTarget: boolean) {
  if (blocking) return 'คุณยอมรับการบล็อก เมื่อทุกคนยอมรับ แอคชั่นเดิมจะถูกยกเลิก';
  if (action === 'Steal') return isTarget ? 'หากไม่มีใครหยุดแอคชั่น คุณจะเสียได้สูงสุด 2 เหรียญ' : 'หากไม่มีใครหยุดแอคชั่น ผู้เล่นที่ถูกเลือกจะเสียได้สูงสุด 2 เหรียญ';
  if (action === 'Assassinate') return isTarget ? 'หากไม่มีใครหยุดแอคชั่น คุณต้องเปิดเผยไพ่ 1 ใบ' : 'หากไม่มีใครหยุดแอคชั่น เป้าหมายต้องเปิดเผยไพ่ 1 ใบ';
  if (action === 'Tax') return 'หากไม่มีใครจับโกหก ผู้ใช้ Tax จะได้รับ 3 เหรียญ';
  if (action === 'ForeignAid') return 'หากไม่มีใครบล็อก ผู้ใช้ Foreign Aid จะได้รับ 2 เหรียญ';
  if (action === 'Exchange') return 'หากไม่มีใครจับโกหก ผู้ใช้ Exchange จะได้จั่ว 2 ใบเพื่อเลือกสลับไพ่';
  return 'คุณยอมให้แอคชั่นนี้ดำเนินต่อเมื่อผู้เล่นที่เหลือยอมรับด้วย';
}
