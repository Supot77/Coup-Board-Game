import { useEffect, useId, useState } from 'react';
import Modal from './Modal';
import HandGuide from './HandGuide';
import RoleBadge from './RoleBadge';
import PlayingCard from './PlayingCard';
import GameIcon from './GameIcon';
import ResponseDecision from './ResponseDecision';
import PlayerAvatar from './PlayerAvatar';
import { actionHelp as actions, getActionLabel, getLivingRoles } from '../core/gameHelp';

function Hand({ cards, small = false }: { cards: any[]; small?: boolean }) {
  return <div className={`influence-cards ${small ? 'small-hand' : ''}`}>
    {cards?.map((card, index) => <PlayingCard key={index} role={card.character} revealed={card.isDead}
      className={`influence-card ${card.isDead ? 'influence-dead' : ''}`} />)}
  </div>;
}

export default function PlayerActionPanel(props: any) {
  const {
    gameState, isMyTurn, myPlayer, players, roomData, userToken, timeLeft, selectedTargetId, confirmTargetAction,
    targetAction, isProcessing, selectedAmbassadorCards, performAction, handleActionClick,
    handleTargetSelect, setTargetAction, handleVotePass, handleChallenge,
    handleBlock, submitDiscard, handleToggleExchangeCard, confirmExchange, showActionsOnly,
  } = props;
  const [category, setCategory] = useState('general');
  const [inspectActions, setInspectActions] = useState(false);
  const actionsContentId = useId();
  const [popupOpen, setPopupOpen] = useState(true);
  const [animateCharacter, setAnimateCharacter] = useState(true);
  const [selectedDiscard, setSelectedDiscard] = useState<number | null>(null);
  const [compact, setCompact] = useState(() => localStorage.getItem('coup_action_density') === 'compact');
  useEffect(() => { localStorage.setItem('coup_action_density', compact ? 'compact' : 'detailed'); }, [compact]);
  useEffect(() => { setSelectedDiscard(null); }, [gameState, roomData.discardTarget]);
  const pending = roomData.pendingAction;
  const responding = gameState === 'waiting_for_responses' || gameState === 'waiting_for_block_responses';
  useEffect(() => {
    setPopupOpen(true);
    setAnimateCharacter(true);
  }, [gameState, pending?.actionName, pending?.sourceId, pending?.targetId, pending?.blockerId, pending?.blockCharacter, roomData.responseWindowId]);

  const alivePlayers = players.filter(p => !p.isDead);
  const isDead = myPlayer?.isDead;
  const ownedRoles = getLivingRoles(myPlayer?.cards, isDead);
  const canTakeTurn = isMyTurn && !isDead && gameState === 'waiting_for_action';
  const waitingForMe = !isDead && responding && !roomData.passVotes?.includes(userToken)
    && !(gameState === 'waiting_for_responses' && pending?.sourceId === userToken)
    && !(gameState === 'waiting_for_block_responses' && pending?.blockerId === userToken);
  const discarding = !isDead && gameState === 'waiting_for_discard' && roomData.discardTarget === userToken;
  const exchanging = !isDead && gameState === 'waiting_for_exchange' && isMyTurn;
  const needsInput = canTakeTurn || waitingForMe || discarding || exchanging;
  const actionsExpanded = needsInput || inspectActions;
  useEffect(() => {
    setInspectActions(false);
    if (waitingForMe) setCategory('response');
    else if (canTakeTurn) setCategory('general');
  }, [needsInput, waitingForMe, canTakeTurn]);
  const reasonDisabled = (action: typeof actions[number]) => {
    if (isDead) return 'คุณตกรอบแล้ว';
    if (isProcessing) return 'กำลังดำเนินการ';
    if (!canTakeTurn) return 'รอถึงตาของคุณ';
    if (myPlayer.coins >= 10 && action.name !== 'Coup') return 'มี 10 เหรียญ ต้อง Coup';
    if (myPlayer.coins < action.cost) return `ต้องมี ${action.cost} เหรียญ`;
    return '';
  };
  const blockRoles = gameState !== 'waiting_for_responses' ? []
    : pending?.actionName === 'ForeignAid' ? ['Duke']
    : pending?.targetId !== userToken ? []
    : pending?.actionName === 'Assassinate' ? ['Contessa']
    : pending?.actionName === 'Steal' ? ['Captain', 'Ambassador'] : [];
  const challengeAllowed = gameState === 'waiting_for_block_responses' || ['Tax', 'Assassinate', 'Steal', 'Exchange'].includes(pending?.actionName);
  const responseCount = waitingForMe && !isProcessing ? 1 + Number(challengeAllowed) + blockRoles.length : 0;
  const claimedRole = gameState === 'waiting_for_block_responses' ? pending?.blockCharacter : actions.find(action => action.name === pending?.actionName)?.role;
  const responseContent = <ResponseDecision key={roomData.responseWindowId ?? [gameState, pending?.actionName, pending?.sourceId, pending?.blockerId].join(':')}
    gameState={gameState} pending={pending} players={players} myPlayer={myPlayer} userToken={userToken}
    timeLeft={timeLeft} waitingForMe={waitingForMe} isProcessing={isProcessing} ownedRoles={ownedRoles}
    blockRoles={blockRoles} challengeAllowed={challengeAllowed} claimedRole={claimedRole}
    animateCharacter={animateCharacter} inline={!popupOpen} handleVotePass={handleVotePass}
    handleChallenge={handleChallenge} handleBlock={handleBlock} />;
  const selectedTarget = alivePlayers.find((player: any) => player.id === selectedTargetId);
  const targetCost = targetAction === 'Coup' ? 7 : targetAction === 'Assassinate' ? 3 : 0;

  let status = isDead ? 'คุณตกรอบแล้ว · ดูเกมต่อได้'
    : discarding ? 'เลือกไพ่ที่จะเปิดเผย'
    : exchanging ? 'เลือกไพ่ที่จะเก็บไว้'
    : responding ? waitingForMe ? 'มีเหตุการณ์รอคุณตอบสนอง' : 'รอผู้เล่นอื่นตอบสนอง'
    : canTakeTurn ? 'ถึงตาคุณแล้ว เลือกแอคชั่น'
    : gameState === 'game_over' ? 'จบเกมแล้ว'
    : `รอ ${players.find(p => p.id === roomData.turnOrder?.[roomData.currentTurnIndex])?.name || 'ผู้เล่น'} ตัดสินใจ`;

  const statusKind = isDead ? 'eliminated' : discarding || exchanging || waitingForMe ? 'attention' : canTakeTurn ? 'your-turn' : 'waiting';

  return <div className={`player-action-panel ${showActionsOnly ? 'actions-only' : ''} ${compact ? 'compact-actions' : ''}`} data-status={statusKind}>
    <section className="game-panel influence-panel" aria-label="ไพ่ของฉัน">
      <h2 className="panel-heading">ไพ่ของคุณ <span className="hand-coin-count">🪙 {myPlayer?.coins} เหรียญ</span></h2>
      <p className="turn-status" aria-live="polite"><span className="turn-status-dot" aria-hidden="true" />{status}</p>
      {!responding && timeLeft !== null && !isDead && <p className="decision-clock">เวลาตัดสินใจ {timeLeft} วินาที</p>}
      <Hand cards={myPlayer?.cards} />
      <p className="hand-influence-count">{myPlayer?.name} · อิทธิพลที่เหลือ {myPlayer?.cards?.filter(card => !card.isDead).length ?? 0}/2</p>
    </section>

    <section className="game-panel actions-panel" aria-label="แอคชั่น">
      <div className="actions-panel-heading">
        <h2 className="panel-heading">แอคชั่น</h2>
        <div className="action-density" role="group" aria-label="ความละเอียดของแอคชั่น">
          <button type="button" aria-pressed={compact} onClick={() => setCompact(true)}>แบบย่อ</button>
          <button type="button" aria-pressed={!compact} onClick={() => setCompact(false)}>แบบละเอียด</button>
        </div>
        {!needsInput && <button type="button" className="utility-button actions-expand-toggle" aria-expanded={actionsExpanded}
          aria-controls={actionsContentId} onClick={() => setInspectActions(value => !value)}>{actionsExpanded ? 'ย่อแอคชั่น' : 'ดูแอคชั่น'}</button>}
      </div>
      {!actionsExpanded && <p className="actions-waiting-summary" role="status">{status}</p>}
      {responding && <div className="event-banner" role="status">
        <span>{waitingForMe ? 'รอคุณตอบสนอง' : 'มีเหตุการณ์ในสภา'}</span>
        <button className="utility-button" onClick={() => setPopupOpen(true)}>เปิดเหตุการณ์</button>
        <small>ปิดหน้าต่างได้ · เวลาตัดสินใจยังเดินต่อ</small>
      </div>}
      <div id={actionsContentId} className="actions-panel-content" hidden={!actionsExpanded}>
      <p className="role-legend"><span><RoleBadge role="" owned /> มีบทบาทนี้</span><span><RoleBadge role="" owned={false} /> สวมบทบาท</span></p>
      <nav hidden={compact && !responding} className="action-categories" aria-label="ประเภทแอคชั่น">
        {[
          ['general', 'ทั่วไป', actions.filter(a => a.role === 'ทั่วไป' && !reasonDisabled(a)).length],
          ['roles', 'ตามบทบาท', actions.filter(a => a.role !== 'ทั่วไป' && !reasonDisabled(a)).length],
          ['response', 'ตอบสนอง', responseCount],
        ].map(([id, label, count]) => <button key={id} type="button" aria-pressed={category === id}
          onClick={() => setCategory(String(id))} className={category === id ? 'category-active' : ''}>
          {label}{Number(count) > 0 && <span className="category-count">{count}</span>}
        </button>)}
      </nav>

      {targetAction ? <div className="action-step target-step">
        <h3>{selectedTarget ? 'ยืนยันเป้าหมาย' : `เลือกเป้าหมาย · ${getActionLabel(targetAction)}`}</h3>
        {selectedTarget ? <>
          <div className="target-confirmation"><span className="target-avatar"><PlayerAvatar avatarId={selectedTarget.avatarId} isReady={false} seatDirection="top" /></span>
            <div><strong>{selectedTarget.name}</strong><span>🪙 {selectedTarget.coins} · อิทธิพล {selectedTarget.influenceCount ?? 2}/2</span></div>
          </div>
          <p>{targetAction === 'Coup' ? 'จ่าย 7 เหรียญ เป้าหมายต้องเปิดเผยอิทธิพล 1 ใบ บล็อกและจับโกหกไม่ได้'
            : targetAction === 'Assassinate' ? 'จ่าย 3 เหรียญเพื่ออ้าง Assassin ลอบสังหารเป้าหมาย บล็อกด้วย Contessa หรือจับโกหกได้ และไม่คืนค่าแอคชั่นเมื่อถูกบล็อก'
            : 'อ้าง Captain เพื่อขโมยสูงสุด 2 เหรียญ เป้าหมายบล็อกด้วย Captain หรือ Ambassador ได้'}</p>
          <div className="response-buttons"><button className="action-choice danger-choice" disabled={!canTakeTurn || isProcessing || myPlayer.coins < targetCost}
            aria-label={`ยืนยัน ${getActionLabel(targetAction)} ใส่ ${selectedTarget.name}${targetCost ? ` · ${targetCost} เหรียญ` : ''}`}
            onClick={confirmTargetAction}><strong>ยืนยัน {getActionLabel(targetAction)}</strong><span className="confirm-target-name">ใส่ {selectedTarget.name}</span>{targetCost > 0 && <small>จ่าย {targetCost} เหรียญ</small>}</button>
            <button className="utility-button" disabled={isProcessing} onClick={() => handleTargetSelect(null)}>เปลี่ยนเป้าหมาย</button></div>
        </> : <div className="target-grid">{alivePlayers.filter((player: any) => player.id !== userToken).map((player: any) => <button key={player.id}
          aria-label={player.name} className="action-choice target-player" disabled={!canTakeTurn || isProcessing} onClick={() => handleTargetSelect(player.id)}>
          <span className="target-avatar"><PlayerAvatar avatarId={player.avatarId} isReady={false} seatDirection="top" /></span><strong>{player.name}</strong>
          <small>🪙 {player.coins} · อิทธิพล {player.influenceCount ?? 2}/2</small></button>)}</div>}
        <button className="utility-button" disabled={isProcessing} onClick={() => setTargetAction(null)}>ยกเลิกการเลือก</button>
      </div> : discarding ? <div className="action-step discard-step">
        <h3>เลือกไพ่ที่จะเปิดเผย</h3><p>เลือก 1 ใบ แล้วกดยืนยัน ไพ่ที่เปิดเผยจะเสียอิทธิพลและทุกคนมองเห็น</p>
        <div className="discard-options">{myPlayer.cards.map((card: any, index: number) => !card.isDead && <button key={index}
          aria-label={`เลือกเปิดเผย ${card.character}`} aria-pressed={selectedDiscard === index}
          className="discard-card" disabled={isProcessing} onClick={() => setSelectedDiscard(index)}>
          <PlayingCard role={card.character} selected={selectedDiscard === index} className="discard-card-visual" />
        </button>)}</div>
        <button className="action-choice danger-choice" disabled={isProcessing || selectedDiscard === null || myPlayer.cards[selectedDiscard]?.isDead}
          onClick={() => selectedDiscard !== null && submitDiscard(selectedDiscard)}>{selectedDiscard === null ? 'เลือกไพ่ก่อนยืนยัน' : `ยืนยันเปิดเผย ${myPlayer.cards[selectedDiscard].character}`}</button>
      </div> : exchanging ? <div className="action-step">
        <h3>เลือกไพ่เก็บไว้ {myPlayer.cards.filter(c => !c.isDead).length} ใบ</h3>
        <div className="exchange-cards">{(roomData.exchangeOptions || [...myPlayer.cards.filter(c => !c.isDead), ...(roomData.drawnCards || [])]).map((card, index) => <button
          key={index} type="button" aria-pressed={selectedAmbassadorCards.includes(index)}
          aria-label={`${card.character} ใบที่ ${index + 1}`} disabled={isProcessing}
          className={`exchange-card ${selectedAmbassadorCards.includes(index) ? 'card-selected' : ''}`} onClick={() => handleToggleExchangeCard(index)}>
          <PlayingCard role={card.character} selected={selectedAmbassadorCards.includes(index)} className="exchange-card-visual" />
          {selectedAmbassadorCards.includes(index) && <span className="exchange-selection-check" aria-hidden="true">✓</span>}
        </button>)}</div>
        <button className="action-choice" disabled={isProcessing || selectedAmbassadorCards.length !== myPlayer.cards.filter(c => !c.isDead).length} onClick={confirmExchange}>ยืนยันการสลับไพ่</button>
      </div> : <>
        {category === 'response' && (responding || !compact) ? responding ? !popupOpen ? responseContent
          : <p className="muted-copy">เปิดหน้าต่างเหตุการณ์เพื่อดูรายละเอียดและตอบสนอง</p>
          : <p className="muted-copy">ยังไม่มีเหตุการณ์ให้ตอบสนอง</p>
          : <>
            {(category === 'roles' || compact) && <p className="muted-copy">อ้างบทบาทได้แม้ไม่มีไพ่ใบนั้น · ผู้เล่นอื่นจับโกหกได้</p>}
            {myPlayer?.coins >= 10 && canTakeTurn && <p className="decision-clock">มี 10 เหรียญขึ้นไป ต้องเลือก Coup</p>}
            <div className="action-grid">{actions.filter(action => compact || (action.role === 'ทั่วไป') === (category === 'general')).map(action => {
              const disabledReason = reasonDisabled(action);
              return <button key={action.name} className="action-choice action-tile" data-action={action.name} data-role={action.role} disabled={!!disabledReason}
                onClick={() => handleActionClick(action.name)}>
                <span className="action-symbol"><GameIcon kind={action.name} /></span>
                <span className="action-role">{action.role}</span>
              <span className="action-title">{action.role !== 'ทั่วไป' && <RoleBadge role={action.role} owned={ownedRoles.has(action.role)} />}{action.label}</span>
                <span>{action.description}</span>
                <span className="action-explanation">{action.response}</span>
                {action.role !== 'ทั่วไป' && <span className="action-explanation">{ownedRoles.has(action.role) ? `คุณมี ${action.role} รองรับแอคชั่นนี้` : `คุณต้องสวมบทบาท ${action.role} หากถูกจับโกหกจะเสียไพ่ 1 ใบ`}</span>}
                <small className={disabledReason ? '' : 'action-ready'}>{disabledReason || 'พร้อม'}</small>
              </button>;
            })}
              {(category === 'roles' || compact) && <div className="role-note"><b><RoleBadge role="Contessa" owned={ownedRoles.has('Contessa')} />Contessa</b><span>บล็อก Assassinate เมื่อคุณเป็นเป้าหมาย</span><small>ปุ่มจะปรากฏใน “ตอบสนอง” เมื่อใช้ได้</small></div>}
            </div>
          </>}
      </>}
      {!responding && <HandGuide roles={ownedRoles} isDead={!!isDead} />}
      </div>
    </section>

    {responding && popupOpen && <Modal className="game-event-dialog" title={gameState === 'waiting_for_block_responses' ? 'มีการประกาศบล็อก' : 'มีการประกาศแอคชั่น'}
      onClose={() => { setAnimateCharacter(false); setPopupOpen(false); }}>
      {responseContent}</Modal>}
  </div>;
}
