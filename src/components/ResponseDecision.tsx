import { useId, useState } from 'react';
import ActionCharacter from './ActionCharacter';
import PlayingCard from './PlayingCard';
import RoleBadge from './RoleBadge';
import { getActionLabel, getPassConsequence } from '../core/gameHelp';

export default function ResponseDecision({ gameState, pending, players, myPlayer, userToken, timeLeft, waitingForMe,
  isProcessing, ownedRoles, blockRoles, challengeAllowed, claimedRole, animateCharacter, inline = false,
  handleVotePass, handleChallenge, handleBlock }: any) {
  const [peek, setPeek] = useState(false);
  const consequenceId = useId();
  const blocking = gameState === 'waiting_for_block_responses';
  const source = players.find((player: any) => player.id === pending?.sourceId);
  const target = players.find((player: any) => player.id === pending?.targetId);
  const blocker = players.find((player: any) => player.id === pending?.blockerId);
  const held = blockRoles.filter((role: string) => ownedRoles.has(role));
  const bluff = blockRoles.filter((role: string) => !ownedRoles.has(role));
  const passConsequence = getPassConsequence(pending?.actionName, blocking, pending?.targetId === userToken);
  const targetedAssassination = !blocking && pending?.actionName === 'Assassinate' && pending?.targetId === userToken;
  const passCaption = blocking ? 'ยอมรับการบล็อก' : pending?.targetId === userToken && pending?.actionName === 'Assassinate' ? 'เสียอิทธิพล 1 ใบ'
    : pending?.targetId === userToken && pending?.actionName === 'Steal' ? 'เสียสูงสุด 2 เหรียญ'
    : pending?.actionName === 'Tax' ? 'อีกฝ่ายรับ 3 เหรียญ' : pending?.actionName === 'ForeignAid' ? 'อีกฝ่ายรับ 2 เหรียญ'
    : pending?.actionName === 'Exchange' ? 'อีกฝ่ายสลับไพ่' : 'ให้แอคชั่นดำเนินต่อ';
  const canAct = waitingForMe && !isProcessing && timeLeft !== 0;
  return <div className="response-decision" data-inline={inline}>
    <div className="response-decision-summary">
      <p className="event-description">{blocking ? <><b title={blocker?.name}>{blocker?.name}</b> อ้างว่ามี <strong>{claimedRole}</strong> บล็อก {getActionLabel(pending?.actionName)}</>
        : <><b title={source?.name}>{source?.name}</b> {claimedRole && claimedRole !== 'ทั่วไป' ? <>อ้างว่ามี <strong>{claimedRole}</strong> · </> : null}<strong>{getActionLabel(pending?.actionName)}</strong>{target && <> → <b title={target.name}>{target.id === userToken ? 'คุณ' : target.name}</b></>}</>}</p>
      {waitingForMe && <p className="decision-clock" role="timer">{timeLeft === null ? 'กำลังซิงค์เวลาตอบโต้…' : timeLeft === 0 ? 'หมดเวลาตอบโต้ · รอดำเนินเกมต่อ' : `เวลาตัดสินใจ ${timeLeft} วินาที`}</p>}
    </div>
    <div className="response-decision-details">
      <ActionCharacter role={claimedRole} animate={animateCharacter} blocking={blocking} />
      {waitingForMe && <aside className="response-guide" aria-label="คำแนะนำการตอบโต้">
        <h3>คุณตอบโต้ครั้งนี้ได้อย่างไร</h3>
        <p>ไพ่ที่ยังใช้ได้ของคุณ: {[...ownedRoles].join(', ') || 'ไม่มี'}</p>
        {blocking ? <p>ยอมรับการบล็อก หรือจับโกหกบทบาท {claimedRole} ได้</p> : <>
          {held.length > 0 && <p className="held-role-advice">คุณมี {held.join(' หรือ ')} จึงบล็อก {getActionLabel(pending?.actionName)} ครั้งนี้ด้วยไพ่จริงได้</p>}
          {blockRoles.length > 0 && held.length === 0 && <p>ไพ่ที่เหลือของคุณไม่มีบทบาทสำหรับบล็อกครั้งนี้</p>}
          {bluff.length > 0 && <p>คุณยังอ้าง {bluff.join(' หรือ ')} เพื่อบล็อกได้ หากถูกจับโกหก คุณต้องเปิดเผยไพ่ 1 ใบ</p>}
          {blockRoles.length === 0 && <p>{['Steal', 'Assassinate'].includes(pending?.actionName) ? 'คุณไม่ได้เป็นเป้าหมาย จึงบล็อกครั้งนี้ไม่ได้' : `${getActionLabel(pending?.actionName)} บล็อกไม่ได้`}</p>}
        </>}
        {targetedAssassination && <p>ถ้าคุณจับโกหกผิด อาจเสียไพ่จากการท้าผิดและจากการลอบสังหาร รวม 2 ใบ</p>}
        {targetedAssassination && bluff.includes('Contessa') && <p>ถ้าอ้าง Contessa ที่ไม่มีแล้วถูกจับได้ อาจเสียไพ่จากการบล็อกเท็จและการลอบสังหาร รวม 2 ใบ</p>}
        <details className="response-explanation"><summary>อ่านผลของแต่ละตัวเลือก</summary>
          <p>{passConsequence}</p>
          {challengeAllowed && <p>จับโกหกคือขอตรวจว่าอีกฝ่ายมี {claimedRole} หรือไม่ ถ้าเขามี คุณต้องเปิดเผยไพ่ 1 ใบ ถ้าเขาไม่มี เขาต้องเปิดเผยไพ่ 1 ใบ</p>}
          {pending?.actionName === 'ForeignAid' && !blocking && <p>Foreign Aid ไม่ได้อ้างบทบาท จึงจับโกหกแอคชั่นนี้ไม่ได้ แต่จับโกหกผู้ที่อ้าง Duke เพื่อบล็อกได้</p>}
        </details>
      </aside>}
      <button type="button" className="utility-button" aria-expanded={peek} onClick={() => setPeek(!peek)}>{peek ? 'ซ่อนไพ่ในมือ' : 'ดูไพ่ในมือของฉัน'}</button>
      {peek && <div className="influence-cards small-hand">{myPlayer.cards?.map((card: any, index: number) => <PlayingCard key={index} role={card.character} revealed={card.isDead} className="influence-card" />)}</div>}
      <p className="muted-copy">ปิดเพื่อดูกระดานได้ แล้วกด “เปิดเหตุการณ์” เพื่อกลับมา · การปิดไม่ใช่การปล่อยผ่าน</p>
    </div>
    <div className="response-decision-controls">
      {waitingForMe ? <div className="response-buttons">
        <button className="action-choice" aria-label="ปล่อยผ่าน" aria-describedby={consequenceId} disabled={!canAct} onClick={handleVotePass}><span>ปล่อยผ่าน</span><small>{passCaption}</small></button>
        {challengeAllowed && <button className="action-choice danger-choice" aria-label="จับโกหก" disabled={!canAct} onClick={handleChallenge}><span>จับโกหก</span><small>{targetedAssassination ? 'ท้าผิด อาจเสียไพ่ 2 ใบ' : 'ท้าผิด เสียไพ่ 1 ใบ'}</small></button>}
        {blockRoles.map((role: string) => <button key={role} className="action-choice" aria-label={`บล็อก · ${role}`} disabled={!canAct} onClick={() => handleBlock(role)}><span><RoleBadge role={role} owned={ownedRoles.has(role)} />บล็อก · {role}</span><small>{ownedRoles.has(role) ? 'คุณมีบทบาทนี้' : 'สวมบทบาท'}</small></button>)}
      </div> : <p className="response-waiting" role="status">{myPlayer.isDead ? 'คุณตกรอบแล้ว สามารถดูเกมต่อได้' : 'คุณไม่ต้องตอบเพิ่ม · รอผู้เล่นอื่นตัดสินใจ'}</p>}
      <span id={consequenceId} className="sr-only">{passConsequence}</span>
    </div>
  </div>;
}
