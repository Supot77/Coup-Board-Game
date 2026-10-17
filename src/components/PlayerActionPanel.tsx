import { useEffect, useState } from 'react';
import Modal from './Modal';
import HandGuide from './HandGuide';
import RoleBadge from './RoleBadge';
import { actionHelp as actions, getActionLabel, getLivingRoles, getPassConsequence } from '../core/gameHelp';

const cardImages: Record<string, string> = {
  Duke: '/img/duk.jpg', Assassin: '/img/ass.jpg', Captain: '/img/cap.jpg',
  Ambassador: '/img/amb.jpg', Contessa: '/img/cont.jpg',
};

function Hand({ cards, small = false }: { cards: any[]; small?: boolean }) {
  return <div className={`influence-cards ${small ? 'small-hand' : ''}`}>
    {cards?.map((card, index) => <div key={index} className={`influence-card ${card.isDead ? 'influence-dead' : ''}`}>
      <img src={cardImages[card.character]} alt="" />
      <span>{card.character}{card.isDead && <small>เปิดเผยแล้ว</small>}</span>
    </div>)}
  </div>;
}

export default function PlayerActionPanel(props: any) {
  const {
    gameState, isMyTurn, myPlayer, players, roomData, userToken, timeLeft, actionToConfirm,
    targetAction, isProcessing, selectedAmbassadorCards, performAction, handleActionClick,
    handleTargetSelect, setTargetAction, setActionToConfirm, handleVotePass, handleChallenge,
    handleBlock, submitDiscard, handleToggleExchangeCard, confirmExchange, showActionsOnly,
  } = props;
  const [category, setCategory] = useState('general');
  const [popupOpen, setPopupOpen] = useState(true);
  const [showPeekCards, setShowPeekCards] = useState(false);
  const pending = roomData.pendingAction;
  const responding = gameState === 'waiting_for_responses' || gameState === 'waiting_for_block_responses';
  useEffect(() => {
    setPopupOpen(true);
    setShowPeekCards(false);
  }, [gameState, pending?.actionName, pending?.sourceId, pending?.targetId, pending?.blockerId, pending?.blockCharacter]);

  const alivePlayers = players.filter(p => !p.isDead);
  const isDead = myPlayer?.isDead;
  const ownedRoles = getLivingRoles(myPlayer?.cards, isDead);
  const canTakeTurn = isMyTurn && !isDead && gameState === 'waiting_for_action';
  const waitingForMe = !isDead && responding && !roomData.passVotes?.includes(userToken)
    && !(gameState === 'waiting_for_responses' && pending?.sourceId === userToken)
    && !(gameState === 'waiting_for_block_responses' && pending?.blockerId === userToken);
  const discarding = !isDead && gameState === 'waiting_for_discard' && roomData.discardTarget === userToken;
  const exchanging = !isDead && gameState === 'waiting_for_exchange' && isMyTurn;
  const reasonDisabled = (action: typeof actions[number]) => {
    if (isDead) return 'คุณตกรอบแล้ว';
    if (isProcessing) return 'กำลังดำเนินการ';
    if (!canTakeTurn) return 'รอถึงตาของคุณ';
    if (myPlayer.coins >= 10 && action.name !== 'Coup') return 'มี 10 เหรียญ ต้อง Coup';
    if (myPlayer.coins < action.cost) return `ต้องมี ${action.cost} เหรียญ`;
    return '';
  };
  const source = players.find(p => p.id === pending?.sourceId);
  const target = players.find(p => p.id === pending?.targetId);
  const blocker = players.find(p => p.id === pending?.blockerId);
  const blockRoles = gameState !== 'waiting_for_responses' ? []
    : pending?.actionName === 'ForeignAid' ? ['Duke']
    : pending?.targetId !== userToken ? []
    : pending?.actionName === 'Assassinate' ? ['Contessa']
    : pending?.actionName === 'Steal' ? ['Captain', 'Ambassador'] : [];
  const challengeAllowed = gameState === 'waiting_for_block_responses' || ['Tax', 'Assassinate', 'Steal', 'Exchange'].includes(pending?.actionName);
  const responseCount = waitingForMe && !isProcessing ? 1 + Number(challengeAllowed) + blockRoles.length : 0;
  const heldBlockRoles = blockRoles.filter(role => ownedRoles.has(role));
  const bluffBlockRoles = blockRoles.filter(role => !ownedRoles.has(role));
  const claimedRole = gameState === 'waiting_for_block_responses' ? pending?.blockCharacter : actions.find(action => action.name === pending?.actionName)?.role;
  const passConsequence = getPassConsequence(pending?.actionName, gameState === 'waiting_for_block_responses', pending?.targetId === userToken);
  const responseContent = <>
    <p className="event-description">
      {gameState === 'waiting_for_block_responses'
        ? <><b>{blocker?.name}</b> อ้างว่ามี <strong>{pending?.blockCharacter}</strong> เพื่อบล็อก {getActionLabel(pending?.actionName)} ของ {source?.name}</>
        : <><b>{source?.name}</b> ใช้ <strong>{getActionLabel(pending?.actionName)}</strong>{target && <> กับ <b>{target.name}</b></>}</>}
    </p>
    {timeLeft !== null && !isDead && <p className="decision-clock" role="timer">เวลาตัดสินใจ {timeLeft} วินาที</p>}
    {waitingForMe && <aside className="response-guide" aria-label="คำแนะนำการตอบโต้">
      <h3>คุณตอบโต้ครั้งนี้ได้อย่างไร</h3>
      <p>ไพ่ที่ยังใช้ได้ของคุณ: {[...ownedRoles].join(', ') || 'ไม่มี'}</p>
      {gameState === 'waiting_for_block_responses'
        ? <p>อีกฝ่ายประกาศบล็อกแล้ว คุณเลือกยอมรับการบล็อก หรือจับโกหกบทบาท {claimedRole} ได้</p>
        : <>
          {heldBlockRoles.length > 0 && <p className="held-role-advice">คุณมี {heldBlockRoles.join(' หรือ ')} จึงบล็อก {getActionLabel(pending?.actionName)} ครั้งนี้ด้วยไพ่จริงได้</p>}
          {blockRoles.length > 0 && heldBlockRoles.length === 0 && <p>ไพ่ที่เหลือของคุณไม่มีบทบาทสำหรับบล็อกครั้งนี้</p>}
          {bluffBlockRoles.length > 0 && <p>คุณยังอ้าง {bluffBlockRoles.join(' หรือ ')} เพื่อบล็อกได้ หากถูกจับโกหก คุณต้องเปิดเผยไพ่ 1 ใบ</p>}
          {blockRoles.length === 0 && <p>{['Steal', 'Assassinate'].includes(pending?.actionName)
            ? 'คุณไม่ได้เป็นเป้าหมาย จึงบล็อกครั้งนี้ไม่ได้'
            : `${getActionLabel(pending?.actionName)} บล็อกไม่ได้`}</p>}
        </>}
      {pending?.actionName === 'Assassinate' && pending?.targetId === userToken && gameState === 'waiting_for_responses' && <p>ถ้าคุณจับโกหกผิด อาจเสียไพ่จากการท้าผิดและจากการลอบสังหาร รวม 2 ใบ</p>}
      <details className="response-explanation">
        <summary>อ่านผลของแต่ละตัวเลือก</summary>
        <p>{passConsequence}</p>
        {challengeAllowed && <p>จับโกหกคือขอตรวจว่าอีกฝ่ายมี {claimedRole} หรือไม่ ถ้าเขามี คุณต้องเปิดเผยไพ่ 1 ใบ ถ้าเขาไม่มี เขาต้องเปิดเผยไพ่ 1 ใบ</p>}
        {pending?.actionName === 'ForeignAid' && gameState === 'waiting_for_responses' && <p>Foreign Aid ไม่ได้อ้างบทบาท จึงจับโกหกแอคชั่นนี้ไม่ได้ แต่ถ้ามีคนอ้าง Duke เพื่อบล็อก คุณจับโกหกการบล็อกนั้นได้</p>}
      </details>
    </aside>}
    {waitingForMe ? <div className="response-buttons">
      <button className="action-choice" disabled={isProcessing} onClick={handleVotePass} title={passConsequence}>ปล่อยผ่าน</button>
      {challengeAllowed && <button className="action-choice danger-choice" disabled={isProcessing} onClick={handleChallenge} title={`ขอตรวจว่าอีกฝ่ายมี ${claimedRole} หรือไม่ หากท้าผิด คุณเสียไพ่ 1 ใบ`}>จับโกหก</button>}
      {blockRoles.map(role => <button key={role} className="action-choice" disabled={isProcessing} onClick={() => handleBlock(role)} title={ownedRoles.has(role) ? `คุณมี ${role} ที่ยังใช้ได้` : `คุณไม่มี ${role} ที่ยังใช้ได้ ต้องสวมบทบาท`}><RoleBadge role={role} owned={ownedRoles.has(role)} /> บล็อก · {role}</button>)}
    </div> : <p className="muted-copy">{isDead ? 'คุณตกรอบแล้ว สามารถดูเกมต่อได้' : 'รอผู้เล่นอื่นตัดสินใจ…'}</p>}
    <button type="button" className="utility-button" aria-expanded={showPeekCards} onClick={() => setShowPeekCards(!showPeekCards)}>
      {showPeekCards ? 'ซ่อนไพ่ในมือ' : 'ดูไพ่ในมือของฉัน'}
    </button>
    {showPeekCards && <Hand cards={myPlayer?.cards} small />}
  </>;

  let status = isDead ? 'คุณตกรอบแล้ว · ดูเกมต่อได้'
    : discarding ? 'เลือกไพ่ที่จะเปิดเผย'
    : exchanging ? 'เลือกไพ่ที่จะเก็บไว้'
    : responding ? waitingForMe ? 'มีเหตุการณ์รอคุณตอบสนอง' : 'รอผู้เล่นอื่นตอบสนอง'
    : canTakeTurn ? 'ถึงตาคุณแล้ว เลือกแอคชั่น'
    : gameState === 'game_over' ? 'จบเกมแล้ว'
    : `รอ ${players.find(p => p.id === roomData.turnOrder?.[roomData.currentTurnIndex])?.name || 'ผู้เล่น'} ตัดสินใจ`;

  return <div className={`player-action-panel ${showActionsOnly ? 'actions-only' : ''}`}>
    <section className="game-panel influence-panel" aria-label="ไพ่ของฉัน">
      <h2 className="panel-heading">ไพ่ของคุณ <span>🪙 {myPlayer?.coins}</span></h2>
      <p className="turn-status" aria-live="polite">{status}</p>
      {!responding && timeLeft !== null && !isDead && <p className="decision-clock">เวลาตัดสินใจ {timeLeft} วินาที</p>}
      <Hand cards={myPlayer?.cards} />
    </section>

    <section className="game-panel actions-panel" aria-label="แอคชั่น">
      <h2 className="panel-heading">แอคชั่น</h2>
      <p className="role-legend"><span><RoleBadge role="" owned /> มีบทบาทนี้</span><span><RoleBadge role="" owned={false} /> สวมบทบาท</span></p>
      {!responding && <HandGuide roles={ownedRoles} isDead={!!isDead} />}
      <nav className="action-categories" aria-label="ประเภทแอคชั่น">
        {[
          ['general', 'ทั่วไป', actions.filter(a => a.role === 'ทั่วไป' && !reasonDisabled(a)).length],
          ['roles', 'ตามบทบาท', actions.filter(a => a.role !== 'ทั่วไป' && !reasonDisabled(a)).length],
          ['response', 'ตอบสนอง', responseCount],
        ].map(([id, label, count]) => <button key={id} type="button" aria-pressed={category === id}
          onClick={() => setCategory(String(id))} className={category === id ? 'category-active' : ''}>
          {label}{Number(count) > 0 && <span className="category-count">{count}</span>}
        </button>)}
      </nav>

      {actionToConfirm ? <div className="action-step">
        <h3>ยืนยันการใช้ {getActionLabel(actionToConfirm)}?</h3>
        <p>ใช้ {actionToConfirm === 'Coup' ? 7 : 3} เหรียญเมื่อเลือกเป้าหมาย</p>
        <div className="response-buttons">
          <button className="action-choice" disabled={isDead || isProcessing} onClick={() => { performAction(actionToConfirm); setActionToConfirm(null); }}>ยืนยัน</button>
          <button className="utility-button" disabled={isProcessing} onClick={() => setActionToConfirm(null)}>ยกเลิก</button>
        </div>
      </div> : targetAction ? <div className="action-step">
        <h3>เลือกเป้าหมาย · {targetAction}</h3>
        <div className="response-buttons">{alivePlayers.filter(p => p.id !== userToken).map(player => <button key={player.id}
          className="action-choice" disabled={isDead || isProcessing} onClick={() => handleTargetSelect(player.id)}>{player.name}</button>)}</div>
        <button className="utility-button" disabled={isProcessing} onClick={() => setTargetAction(null)}>ยกเลิกการเลือก</button>
      </div> : discarding ? <div className="action-step">
        <h3>เลือกไพ่ที่จะเปิดเผย</h3>
        <div className="response-buttons">{myPlayer.cards.map((card, index) => !card.isDead && <button key={index}
          className="action-choice danger-choice" disabled={isProcessing} onClick={() => submitDiscard(index)}>เปิดเผย {card.character}</button>)}</div>
      </div> : exchanging ? <div className="action-step">
        <h3>เลือกไพ่เก็บไว้ {myPlayer.cards.filter(c => !c.isDead).length} ใบ</h3>
        <div className="exchange-cards">{(roomData.exchangeOptions || [...myPlayer.cards.filter(c => !c.isDead), ...(roomData.drawnCards || [])]).map((card, index) => <button
          key={index} type="button" aria-pressed={selectedAmbassadorCards.includes(index)}
          aria-label={`${card.character} ใบที่ ${index + 1}`} disabled={isProcessing}
          className={`exchange-card ${selectedAmbassadorCards.includes(index) ? 'card-selected' : ''}`} onClick={() => handleToggleExchangeCard(index)}>
          <img src={cardImages[card.character]} alt="" /><span>{selectedAmbassadorCards.includes(index) && '✓ '}{card.character}</span>
        </button>)}</div>
        <button className="action-choice" disabled={isProcessing || selectedAmbassadorCards.length !== myPlayer.cards.filter(c => !c.isDead).length} onClick={confirmExchange}>ยืนยันการสลับไพ่</button>
      </div> : <>
        {responding && <div className="event-banner" role="status">
          <span>{waitingForMe ? 'รอคุณตอบสนอง' : 'มีเหตุการณ์ในสภา'}</span>
          <button className="utility-button" onClick={() => setPopupOpen(true)}>เปิดเหตุการณ์</button>
          <small>ปิดหน้าต่างได้ · เวลาตัดสินใจยังเดินต่อ</small>
        </div>}
        {category === 'response' ? responding ? !popupOpen ? responseContent
          : <p className="muted-copy">เปิดหน้าต่างเหตุการณ์เพื่อดูรายละเอียดและตอบสนอง</p>
          : <p className="muted-copy">ยังไม่มีเหตุการณ์ให้ตอบสนอง</p>
          : <>
            {category === 'roles' && <p className="muted-copy">อ้างบทบาทได้แม้ไม่มีไพ่ใบนั้น · ผู้เล่นอื่นจับโกหกได้</p>}
            {myPlayer?.coins >= 10 && canTakeTurn && <p className="decision-clock">มี 10 เหรียญขึ้นไป ต้องเลือก Coup</p>}
            <div className="action-grid">{actions.filter(action => (action.role === 'ทั่วไป') === (category === 'general')).map(action => {
              const disabledReason = reasonDisabled(action);
              return <button key={action.name} className="action-choice action-tile" disabled={!!disabledReason}
                onClick={() => handleActionClick(action.name)}>
                <span className="action-role">{action.role}</span>
              <span className="action-title">{action.role !== 'ทั่วไป' && <RoleBadge role={action.role} owned={ownedRoles.has(action.role)} />}{action.label}</span>
                <span>{action.description}</span>
                <span className="action-explanation">{action.response}</span>
                {action.role !== 'ทั่วไป' && <span className="action-explanation">{ownedRoles.has(action.role) ? `คุณมี ${action.role} รองรับแอคชั่นนี้` : `คุณต้องสวมบทบาท ${action.role} หากถูกจับโกหกจะเสียไพ่ 1 ใบ`}</span>}
                <small className={disabledReason ? '' : 'action-ready'}>{disabledReason || 'พร้อม'}</small>
              </button>;
            })}
              {category === 'roles' && <div className="role-note"><b><RoleBadge role="Contessa" owned={ownedRoles.has('Contessa')} />Contessa</b><span>บล็อก Assassinate เมื่อคุณเป็นเป้าหมาย</span><small>ปุ่มจะปรากฏใน “ตอบสนอง” เมื่อใช้ได้</small></div>}
            </div>
          </>}
      </>}
    </section>

    {responding && popupOpen && <Modal title={gameState === 'waiting_for_block_responses' ? 'มีการประกาศบล็อก' : 'มีการประกาศแอคชั่น'}
      onClose={() => setPopupOpen(false)}>{responseContent}<p className="muted-copy">ปิดเพื่อดูกระดานได้ แล้วกด “เปิดเหตุการณ์” เพื่อกลับมา · การปิดไม่ใช่การปล่อยผ่าน</p></Modal>}
  </div>;
}
