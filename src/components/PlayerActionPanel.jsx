import React from 'react';

const cardImages = {
  "Duke": "/img/duk.jpg",
  "Assassin": "/img/ass.jpg",
  "Captain": "/img/cap.jpg",
  "Ambassador": "/img/amb.jpg",
  "Contessa": "/img/cont.jpg"
};

const actionCharacterMap = { "Tax": "Duke", "Assassinate": "Assassin", "Steal": "Captain", "Exchange": "Ambassador" };

export default function PlayerActionPanel({ 
  gameState, isMyTurn, myPlayer, players, roomData, userToken, timeLeft, actionToConfirm, targetAction, isProcessing, 
  selectedAmbassadorCards, performAction, handleActionClick, handleTargetSelect, setTargetAction, setActionToConfirm, 
  handleVotePass, handleChallenge, handleBlock, submitDiscard, handleToggleExchangeCard, confirmExchange 
}) {
  const alivePlayers = players.filter(p => !p.isDead);
  const isDead = myPlayer?.isDead;

  let statusText = "";
  let statusColor = "#d4af37"; 
  
  if (isDead) {
    statusText = "💀 คุณเสียชีวิตแล้ว ได้แต่เฝ้าดูการต่อสู้";
    statusColor = "#ef4444";
  } else if (gameState === "waiting_for_action") {
    statusText = isMyTurn ? "⭐ ตาของคุณแล้ว! เลือก Action" : `⏳ รอ ${players.find(p => p.id === roomData?.turnOrder?.[roomData?.currentTurnIndex])?.name} ตัดสินใจ`;
    if(!isMyTurn) statusColor = "#888";
  } else if (gameState === "waiting_for_responses" || gameState === "waiting_for_block_responses") {
    statusText = roomData.pendingAction?.sourceId === userToken || roomData.pendingAction?.blockerId === userToken ? "⏳ รอคนอื่นตอบรับ..." : "🚨 มีเหตุการณ์เกิดขึ้น!";
    if(roomData.pendingAction?.sourceId !== userToken && roomData.pendingAction?.blockerId !== userToken) statusColor = "#fca5a5";
  } else if (gameState === "waiting_for_discard") {
    statusText = roomData.discardTarget === userToken ? "💀 คุณต้องเลือกเสียอิทธิพล 1 ใบ!" : "💀 มีผู้เล่นกำลังเสียอิทธิพล";
    if(roomData.discardTarget === userToken) statusColor = "#ef4444";
  } else if (gameState === "waiting_for_exchange") {
    statusText = isMyTurn ? "🔄 โปรดเลือกไพ่ที่จะเก็บไว้" : "⏳ รอ Ambassador ตัดสินใจ";
    if(isMyTurn) statusColor = "#34d399";
  }

  // ป้องกันคนตายโหวตด้วยการเพิ่ม !isDead เข้าไป
  const isWaitingForMyResponse = !isDead && (gameState === "waiting_for_responses" || gameState === "waiting_for_block_responses") && 
                                 !roomData.passVotes?.includes(userToken) && 
                                 !(gameState === "waiting_for_responses" && roomData.pendingAction?.sourceId === userToken) && 
                                 !(gameState === "waiting_for_block_responses" && roomData.pendingAction?.blockerId === userToken);

  const needsActionSpace = !isDead && (
    (isMyTurn && gameState === "waiting_for_action") || targetAction !== null || actionToConfirm !== null || 
    (gameState === "waiting_for_discard" && roomData.discardTarget === userToken) || (gameState === "waiting_for_exchange" && isMyTurn)
  );

  const sourcePlayer = roomData?.pendingAction ? players.find(p => p.id === roomData.pendingAction.sourceId) : null;
  const targetPlayer = roomData?.pendingAction?.targetId ? players.find(p => p.id === roomData.pendingAction.targetId) : null;
  const blockerPlayer = roomData?.pendingAction?.blockerId ? players.find(p => p.id === roomData.pendingAction.blockerId) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '15px' }}>
      
      {/* ================= โซน YOUR INFLUENCE ================= */}
      <div className={`gb-panel pulse-glow panel-influence ${needsActionSpace ? 'compact' : ''}`}>
        <div className="gb-panel-title" style={{ color: '#d4af37', position: 'absolute', top: '15px', left: '15px' }}>👤 YOUR INFLUENCE</div>
        
        <div style={{ textAlign: 'center', marginBottom: needsActionSpace ? '10px' : '20px', transition: 'all 0.3s' }}>
          <div style={{ color: statusColor, fontSize: needsActionSpace ? '14px' : '16px', fontWeight: 'bold', marginBottom: needsActionSpace ? '5px' : '10px', transition: 'all 0.3s' }}>
            {statusText}
          </div>
          {!isDead && timeLeft !== null && (
            <div style={{ color: timeLeft <= 5 ? '#ef4444' : '#d4af37', fontSize: '14px', marginBottom: needsActionSpace ? '5px' : '15px' }}>
              ⏳ เวลาตัดสินใจ: {timeLeft} วิ
            </div>
          )}
          {/* โค้ดใหม่ที่ถูกต้อง */}
          <div style={{ fontSize: needsActionSpace ? '24px' : '32px', color: '#d4af37', fontWeight: '900', transition: 'all 0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span className="glowing-coin" style={{ fontSize: needsActionSpace ? '22px' : '28px' }}>🪙</span> {myPlayer?.coins} Coins
          </div>
        </div>

        <div className="card-container">
          {myPlayer?.cards?.map((c, i) => (
            <div key={i} className="player-card-ui" style={{ 
              opacity: c.isDead ? 0.3 : 1, filter: c.isDead ? 'grayscale(1)' : 'none',
              backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.9)), url(${cardImages[c.character] || ''})`
            }}>
              <span className="card-name-text" style={{ textDecoration: c.isDead ? 'line-through' : 'none' }}>{c.character}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ================= โซน ACTIONS & RESPONSES ================= */}
      <div className={`gb-panel panel-actions ${needsActionSpace ? 'expanded' : ''}`}>
        <div className="gb-panel-title">⚔️ ACTIONS</div>
        
        <div className="action-content-wrapper">
          {/* 1. กล่องยืนยันการทำ Action */}
          {actionToConfirm ? (
            <div style={{ textAlign: 'center', width: '100%' }}>
               <h3 style={{ color: '#e2e0e8', marginTop: 0 }}>ยืนยันการใช้ {actionToConfirm}?</h3>
               <p style={{ color: '#888', fontSize: '14px' }}>คุณจะเสีย {actionToConfirm === "Coup" ? 7 : 3} เหรียญทันที</p>
               <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '20px' }}>
                 <button className="gb-badge" style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399', border: '1px solid rgba(16,185,129,0.5)', padding: '12px 30px', cursor: 'pointer' }} disabled={isDead || isProcessing} onClick={() => { performAction(actionToConfirm); setActionToConfirm(null); }}>✅ ยืนยัน</button>
                 <button className="gb-badge" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)', padding: '12px 30px', cursor: 'pointer' }} disabled={isDead || isProcessing} onClick={() => setActionToConfirm(null)}>❌ ยกเลิก</button>
               </div>
            </div>
          ) : 

          /* 2. กล่องเลือกเป้าหมาย */
          targetAction ? (
            <div style={{ textAlign: 'center', width: '100%' }}>
              <h3 style={{ color: '#d4af37', marginTop: 0 }}>🎯 เลือกเป้าหมาย: {targetAction}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px', marginTop: '15px' }}>
                {alivePlayers.filter(p => p.id !== userToken).map(p => (
                  <button key={p.id} className="gb-action-btn" style={{ flex: 'none', width: 'auto', padding: '10px 20px', textAlign: 'center' }} disabled={isDead || isProcessing} onClick={() => handleTargetSelect(p.id)}>
                    {p.name}
                  </button>
                ))}
              </div>
              <button style={{ background: 'transparent', color: '#f87171', border: 'none', marginTop: '20px', textDecoration: 'underline', cursor: 'pointer' }} disabled={isDead || isProcessing} onClick={() => setTargetAction(null)}>ยกเลิกการเลือก</button>
            </div>
          ) : 

          /* 3. กรณีมี Action เกิดขึ้น (แสดงข้อความชั่วคราวบนกล่องหลัก เพราะป๊อปอัปจะเด้งทับแล้ว) */
          (gameState === "waiting_for_responses" || gameState === "waiting_for_block_responses") ? (
            <div style={{ color: '#666', fontStyle: 'italic', padding: '20px', textAlign: 'center' }}>
              โปรดดูหน้าต่างแจ้งเตือนกลางหน้าจอ...
            </div>
          ) : 

          /* 4. กล่องบังคับทิ้งไพ่ */
          gameState === "waiting_for_discard" && roomData.discardTarget === userToken ? (
            <div style={{ textAlign: 'center', width: '100%' }}>
              <h3 style={{ marginTop: 0, color: '#fca5a5', fontSize: '16px' }}>💀 เลือกไพ่ที่จะทิ้ง</h3>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '15px' }}>
                {myPlayer.cards.map((c, i) => !c.isDead && (
                  <button key={i} className="gb-action-btn" style={{ flex: 'none', width: '130px', textAlign: 'center', border: '1px solid #ef4444' }} disabled={isDead || isProcessing} onClick={() => submitDiscard(i)}>
                    ทิ้ง {c.character}
                  </button>
                ))}
              </div>
            </div>
          ) : 

          /* 5. กล่องเลือกสลับไพ่ (Ambassador) */
          gameState === "waiting_for_exchange" && isMyTurn ? (
            <div style={{ textAlign: 'center', width: '100%' }}>
              <h3 style={{ color: '#d4af37', marginTop: 0, fontSize: '16px' }}>🔄 เลือกไพ่ที่จะเก็บไว้ {myPlayer.cards.filter(c => !c.isDead).length} ใบ</h3>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', margin: '15px 0' }}>
                {[...myPlayer.cards.filter(c => !c.isDead), ...(roomData.drawnCards || [])].map((c, i) => {
                  const isSelected = selectedAmbassadorCards.includes(i);
                  return (
                    <div key={i} onClick={() => !isProcessing && handleToggleExchangeCard(i)} 
                      style={{ 
                        width: '85px', height: '125px', borderRadius: '8px', cursor: 'pointer', 
                        border: isSelected ? '3px solid #d4af37' : '1px solid rgba(255,255,255,0.2)', 
                        transform: isSelected ? 'translateY(-10px)' : 'none', transition: '0.2s', 
                        backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.8)), url(${cardImages[c.character]})`,
                        backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' 
                      }}>
                      <div style={{ position:'absolute', bottom:0, width:'100%', padding: '4px 0', fontSize: '11px', fontWeight: 'bold', color: '#fff', textAlign: 'center' }}>{c.character}</div>
                      {isSelected && <div style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#d4af37', color: 'black', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>✓</div>}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button className="gb-badge" style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399', border: '1px solid #10b981', cursor: 'pointer', width: '200px', justifyContent: 'center', padding: '10px' }} 
                  disabled={isProcessing || selectedAmbassadorCards.length !== myPlayer.cards.filter(c => !c.isDead).length} 
                  onClick={confirmExchange}>
                  ยืนยันการสลับไพ่
                </button>
              </div>
            </div>
          ) : 

          /* 6. แผงปุ่ม Actions หลัก */
          isMyTurn && !isDead && gameState === "waiting_for_action" ? (
            <div className="gb-action-grid" style={{ width: '100%' }}>
              <button className="gb-action-btn action-income" disabled={myPlayer.coins >= 10 || isProcessing} onClick={() => performAction("Income")}>
                <div className="action-info"><b className="action-name">Income</b><span className="action-cost color-gold">+1 💰</span></div>
                <small className="action-desc">รับรายได้พื้นฐาน</small>
              </button>
              <button className="gb-action-btn action-foreign" disabled={myPlayer.coins >= 10 || isProcessing} onClick={() => performAction("ForeignAid")}>
                <div className="action-info"><b className="action-name">Foreign Aid</b><span className="action-cost color-blue">+2 💰</span></div>
                <small className="action-desc">รับเงินช่วยเหลือ (Duke บล็อกได้)</small>
              </button>
              <button className="gb-action-btn action-coup" disabled={myPlayer.coins < 7 || isProcessing} onClick={() => handleActionClick("Coup")}>
                <div className="action-info"><b className="action-name">Coup</b><span className="action-cost color-red">-7 💰</span></div>
                <small className="action-desc">โค่นล้มอิทธิพลคู่แข่ง</small>
              </button>
              <button className="gb-action-btn action-tax" disabled={myPlayer.coins >= 10 || isProcessing} onClick={() => performAction("Tax")}>
                <div className="action-info"><b className="action-name">Tax (Duke)</b><span className="action-cost color-purple">+3 💰</span></div>
                <small className="action-desc">เก็บภาษีจากกองกลาง</small>
              </button>
              <button className="gb-action-btn action-assassinate" disabled={myPlayer.coins < 3 || myPlayer.coins >= 10 || isProcessing} onClick={() => handleActionClick("Assassinate")}>
                <div className="action-info"><b className="action-name">Assassinate</b><span className="action-cost color-red">-3 💰</span></div>
                <small className="action-desc">ลอบสังหาร (Contessa บล็อกได้)</small>
              </button>
              <button className="gb-action-btn action-steal" disabled={myPlayer.coins >= 10 || isProcessing} onClick={() => performAction("Steal")}>
                <div className="action-info"><b className="action-name">Steal (Captain)</b><span className="action-cost color-blue">ขโมย 2 💰</span></div>
                <small className="action-desc">ปล้นเงินจากผู้เล่นอื่น</small>
              </button>
              <button className="gb-action-btn action-exchange" disabled={myPlayer.coins >= 10 || isProcessing} onClick={() => performAction("Exchange")} style={{ flex: '1 1 100%' }}>
                <div className="action-info"><b className="action-name">Exchange</b><span className="action-cost color-green">สลับไพ่</span></div>
                <small className="action-desc">แลกเปลี่ยนตัวละครกับกองกลาง (Ambassador)</small>
              </button>
            </div>
          ) : (
            <div style={{ color: '#666', fontStyle: 'italic', padding: '20px' }}>กำลังรอเหตุการณ์ถัดไป...</div>
          )}
        </div>
      </div>

      {/* ================= 🚨 ACTION POPUP OVERLAY (เด้งขึ้นมาเมื่อมีแอคชั่น) ================= */}
      {(gameState === "waiting_for_responses" || gameState === "waiting_for_block_responses") && (
        <div className="action-popup-overlay">
          <div className={`action-popup-box ${gameState === "waiting_for_block_responses" ? "block-mode" : "action-mode"}`}>
            
            <div className="popup-icon">{gameState === "waiting_for_responses" ? "⚠️" : "🛡️"}</div>
            <h2 className="popup-title">
              {gameState === "waiting_for_responses" ? "มีการประกาศใช้ Action!" : "มีการประกาศ Block!"}
            </h2>

            {/* ส่วนแจ้งรายละเอียดว่าใครทำอะไรใส่ใคร แบบเน้นสีจัดจ้าน */}
            <div className="popup-description">
              {gameState === "waiting_for_responses" ? (
                <>
                  <span className="popup-text-gold">{sourcePlayer?.name}</span>
                  <span className="popup-text-white"> ประกาศใช้ </span>
                  <span className="popup-highlight-red">{roomData.pendingAction.actionName}</span>
                  {targetPlayer && (
                    <>
                      <span className="popup-text-white"> ใส่ </span>
                      <span className="popup-text-gold">{targetPlayer.name}</span>
                    </>
                  )}
                </>
              ) : (
                <>
                  <span className="popup-text-gold">{blockerPlayer?.name}</span>
                  <span className="popup-text-white"> ประกาศบล็อก </span>
                  <span className="popup-highlight-red">{roomData.pendingAction.actionName}</span>
                  <span className="popup-text-white"> ของ </span>
                  <span className="popup-text-gold">{sourcePlayer?.name}</span>
                  <br/><span className="popup-text-white" style={{ display: 'inline-block', marginTop: '8px' }}>โดยอ้างสิทธิ์ </span>
                  <span className="popup-highlight-blue">{roomData.pendingAction.blockCharacter}</span>
                </>
              )}
            </div>

            {/* กล่องปุ่มกดตอบสนองด้านล่าง */}
            {isWaitingForMyResponse ? (
              <div className="popup-actions-container">
                <p style={{ color: '#e2e0e8', margin: '0 0 15px 0' }}>คุณจะตัดสินใจอย่างไร?</p>
                
                <div className="popup-btn-group">
                  <button className="gb-badge btn-allow" disabled={isDead || isProcessing} onClick={handleVotePass}>
                    ✅ Allow (ปล่อยผ่าน)
                  </button>
                  <button className="gb-badge btn-challenge" disabled={isDead || isProcessing} onClick={handleChallenge}>
                    🚨 Challenge (จับโกหก)
                  </button>
                </div>

                {/* ปุ่ม Block พิเศษตามสถานการณ์ */}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '15px' }}>
                  {gameState === "waiting_for_responses" && roomData.pendingAction.actionName === "ForeignAid" && <button className="gb-badge btn-block" disabled={isDead || isProcessing} onClick={() => handleBlock("Duke")}>🛡️ Block (Duke)</button>}
                  {gameState === "waiting_for_responses" && roomData.pendingAction.actionName === "Assassinate" && roomData.pendingAction.targetId === userToken && <button className="gb-badge btn-block" disabled={isDead || isProcessing} onClick={() => handleBlock("Contessa")}>🛡️ Block (Contessa)</button>}
                  {gameState === "waiting_for_responses" && roomData.pendingAction.actionName === "Steal" && roomData.pendingAction.targetId === userToken && (
                    <>
                      <button className="gb-badge btn-block" disabled={isDead || isProcessing} onClick={() => handleBlock("Captain")}>🛡️ Block (Captain)</button>
                      <button className="gb-badge btn-block" disabled={isDead || isProcessing} onClick={() => handleBlock("Ambassador")}>🛡️ Block (Ambassador)</button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="popup-waiting">
                ⏳ กำลังรอผู้เล่นอื่นตัดสินใจ...
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}