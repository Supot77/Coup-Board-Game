import React from 'react';

const cardImages = {
  "Duke": "/img/duk.jpg?v=2",
  "Assassin": "/img/ass.jpg?v=2",
  "Captain": "/img/cap.jpg?v=2",
  "Ambassador": "/img/amb.jpg?v=2",
  "Contessa": "/img/cont.jpg?v=2"
};

const actionCharacterMap = { "Tax": "Duke", "Assassinate": "Assassin", "Steal": "Captain", "Exchange": "Ambassador" };

export default function PlayerActionPanel({ 
  gameState, isMyTurn, myPlayer, players, roomData, userToken, timeLeft, 
  actionToConfirm, targetAction, isProcessing, selectedAmbassadorCards,
  performAction, handleActionClick, handleTargetSelect, setTargetAction, 
  setActionToConfirm, handleVotePass, handleChallenge, handleBlock, 
  submitDiscard, handleToggleExchangeCard, confirmExchange 
}) {
  const alivePlayers = players.filter(p => !p.isDead);
  
  // 🌟 ประกาศตัวแปรเพื่อเช็คว่าผู้เล่นคนนี้ตายหรือยัง
  const isDead = myPlayer?.isDead;

  return (
    <div className="game-right-panel">
      <div style={{ textAlign: 'center', marginBottom: '15px', backgroundColor: 'rgba(0,0,0,0.4)', padding: '15px', borderRadius: '8px' }}>
        <h2 style={{ color: 'var(--gold)', margin: 0, fontSize: '22px' }}>
          {isDead ? "💀 คุณเสียชีวิตแล้ว ได้แต่เฝ้าดูการต่อสู้" : (
            <>
              {gameState === "waiting_for_action" && (isMyTurn ? "⭐ ตาของคุณแล้ว! เลือก Action" : `⏳ รอ ${players.find(p => p.id === roomData?.turnOrder?.[roomData?.currentTurnIndex])?.name} ตัดสินใจ`)}
              {gameState === "waiting_for_responses" && (roomData.pendingAction.sourceId === userToken ? "⏳ รอคนอื่นโหวต..." : "🚨 รอคุณตัดสินใจ!")}
              {gameState === "waiting_for_block_responses" && (roomData.pendingAction.blockerId === userToken ? "⏳ รอคนอื่นโหวตการบล็อก..." : "🛡️ มีคนบล็อก! รอคุณตัดสินใจ")}
              {gameState === "waiting_for_discard" && (roomData.discardTarget === userToken ? "💀 คุณต้องเสียอิทธิพล!" : "💀 มีผู้เล่นกำลังเสียอิทธิพล")}
              {gameState === "waiting_for_exchange" && (isMyTurn ? "🔄 โปรดเลือกไพ่ที่จะเก็บไว้" : "⏳ รอ Ambassador ตัดสินใจ")}
            </>
          )}
        </h2>
        {!isDead && timeLeft !== null && <p style={{ color: timeLeft <= 5 ? 'var(--red)' : 'var(--gold)', fontWeight: 'bold', fontSize: '18px', margin: '5px 0' }}>⏳ เวลาตัดสินใจ: {timeLeft} วิ</p>}
      </div>

      <h3 style={{ margin: '0 0 15px 0', fontSize: '20px', textAlign: 'center' }}>
        👤 {myPlayer.name} | <span style={{ color: 'var(--gold)' }}>💰 เงิน: {myPlayer.coins}</span>
      </h3>
      
      <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginBottom: '25px' }}>
        {myPlayer.cards?.map((c, i) => (
          <div key={i} style={{ width: '110px', height: '160px', borderRadius: '10px', border: '3px solid white', backgroundImage: `url(${cardImages[c.character]})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: c.isDead ? 0.5 : 1, filter: c.isDead ? 'grayscale(100%)' : 'none', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 8px rgba(0,0,0,0.5)' }}>
            <div style={{ position:'absolute', bottom:0, width:'100%', background:'rgba(0,0,0,0.8)', color:'white', textAlign:'center', fontWeight:'bold', padding: '5px 0', fontSize: '15px', textDecoration: c.isDead ? 'line-through' : 'none' }}>
              {c.character}
            </div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        
        {actionToConfirm && (
          <div style={{ textAlign: 'center', padding: '15px', backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: '10px', border: '2px solid var(--red)', marginBottom: '15px' }}>
             <h3 style={{color: 'white', marginTop: 0}}>แน่ใจหรือไม่ที่จะใช้ {actionToConfirm}?</h3>
             <p style={{color: 'white'}}>คุณจะเสีย {actionToConfirm === "Coup" ? 7 : 3} เหรียญทันทีเมื่อกดยืนยัน</p>
             <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
               {/* 🌟 ป้องกันด้วย isDead */}
               <button className="primary" disabled={isDead || isProcessing} onClick={() => { performAction(actionToConfirm); setActionToConfirm(null); }}>✅ ยืนยัน</button>
               <button className="danger" disabled={isDead || isProcessing} onClick={() => setActionToConfirm(null)}>❌ ยกเลิก</button>
             </div>
          </div>
        )}

        {!actionToConfirm && targetAction && (
          <div style={{ textAlign: 'center', padding: '15px', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: '10px' }}>
            <h3 style={{ color: 'var(--gold)', marginTop: 0 }}>เลือกเป้าหมาย: {targetAction}</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
              {alivePlayers.filter(p => p.id !== userToken).map(p => (
                <button key={p.id} className="primary" disabled={isDead || isProcessing} onClick={() => handleTargetSelect(p.id)}>{p.name}</button>
              ))}
            </div>
            <button className="danger" disabled={isDead || isProcessing} onClick={() => setTargetAction(null)} style={{ marginTop: '10px' }}>❌ ยกเลิก</button>
          </div>
        )}

        {!actionToConfirm && !targetAction && 
         (gameState === "waiting_for_responses" || gameState === "waiting_for_block_responses") && 
         !roomData.passVotes?.includes(userToken) && 
         !(gameState === "waiting_for_responses" && roomData.pendingAction.sourceId === userToken) && 
         !(gameState === "waiting_for_block_responses" && roomData.pendingAction.blockerId === userToken) && (
          <div style={{ textAlign: 'center', padding: '20px', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: '10px' }}>
            <button className="primary" style={{ fontSize: '16px', width: '100%' }} disabled={isDead || isProcessing} onClick={handleVotePass}>✅ ยอม (Pass)</button>
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              {gameState === "waiting_for_responses" && actionCharacterMap[roomData.pendingAction.actionName] && (
                 <button className="danger" style={{ flex: 1, fontSize: '16px' }} disabled={isDead || isProcessing} onClick={handleChallenge}>🚨 จับโกหก!</button>
              )}
              {gameState === "waiting_for_block_responses" && (
                 <button className="danger" style={{ flex: 1, fontSize: '16px' }} disabled={isDead || isProcessing} onClick={handleChallenge}>🚨 จับโกหกคนบล็อก!</button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '5px', marginTop: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {gameState === "waiting_for_responses" && roomData.pendingAction.actionName === "ForeignAid" && <button className="gold" disabled={isDead || isProcessing} onClick={() => handleBlock("Duke")}>🛡️ บล็อก (Duke)</button>}
              {gameState === "waiting_for_responses" && roomData.pendingAction.actionName === "Assassinate" && roomData.pendingAction.targetId === userToken && <button className="gold" disabled={isDead || isProcessing} onClick={() => handleBlock("Contessa")}>🛡️ บล็อก (Contessa)</button>}
              {gameState === "waiting_for_responses" && roomData.pendingAction.actionName === "Steal" && roomData.pendingAction.targetId === userToken && (
                <><button className="gold" disabled={isDead || isProcessing} onClick={() => handleBlock("Captain")}>🛡️ บล็อก (Captain)</button><button className="gold" disabled={isDead || isProcessing} onClick={() => handleBlock("Ambassador")}>🛡️ บล็อก (Ambassador)</button></>
              )}
            </div>
          </div>
        )}

        {gameState === "waiting_for_discard" && roomData.discardTarget === userToken && (
          <div style={{ textAlign: 'center', padding: '20px', backgroundColor: 'var(--red)', borderRadius: '10px' }}>
            <h3 style={{ marginTop: 0, color: 'white' }}>💀 เลือกไพ่ที่ต้องการทิ้ง</h3>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              {myPlayer.cards.map((c, i) => !c.isDead && (
                <button key={i} style={{ backgroundColor: 'black', color: 'white', fontSize: '16px', flex: 1 }} disabled={isDead || isProcessing} onClick={() => submitDiscard(i)}>ทิ้ง {c.character}</button>
              ))}
            </div>
          </div>
        )}

        {gameState === "waiting_for_exchange" && isMyTurn && (
          <div style={{ textAlign: 'center', padding: '15px', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: '10px' }}>
            <h3 style={{ color: 'var(--gold)', marginTop: 0 }}>🔄 เลือกไพ่ที่ต้องการเก็บไว้</h3>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {[...myPlayer.cards.filter(c => !c.isDead), ...(roomData.drawnCards || [])].map((c, i) => {
                const isSelected = selectedAmbassadorCards.includes(i);
                return (
                  <div key={i} onClick={() => { if(!isDead && !isProcessing) handleToggleExchangeCard(i); }} style={{ width: '85px', height: '120px', borderRadius: '8px', cursor: 'pointer', border: isSelected ? '4px solid var(--gold)' : '2px solid #ccc', transform: isSelected ? 'translateY(-10px)' : 'none', transition: '0.2s', backgroundImage: `url(${cardImages[c.character]})`, backgroundSize: 'cover', position: 'relative' }}>
                    <div style={{ position:'absolute', bottom:0, width:'100%', background:'rgba(0,0,0,0.8)', fontSize: '12px', padding: '4px 0', fontWeight: 'bold' }}>{c.character}</div>
                  </div>
                );
              })}
            </div>
            <button className="primary" style={{ marginTop: '20px', width: '100%', fontSize: '16px' }} disabled={isDead || isProcessing} onClick={confirmExchange}>ยืนยันการเลือก</button>
          </div>
        )}

        {!actionToConfirm && !targetAction && isMyTurn && gameState === "waiting_for_action" && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
            <button style={{ flex: '1 1 30%' }} disabled={isDead || myPlayer.coins >= 10 || isProcessing} onClick={() => performAction("Income")}>Income (+1)</button>
            <button style={{ flex: '1 1 30%' }} disabled={isDead || myPlayer.coins >= 10 || isProcessing} onClick={() => performAction("ForeignAid")}>Foreign Aid (+2)</button>
            <button style={{ flex: '1 1 30%' }} disabled={isDead || myPlayer.coins < 7 || isProcessing} className="danger" onClick={() => handleActionClick("Coup")}>Coup (-7)</button>
            <button style={{ flex: '1 1 45%' }} disabled={isDead || myPlayer.coins >= 10 || isProcessing} className="gold" onClick={() => performAction("Tax")}>Duke (Tax)</button>
            <button style={{ flex: '1 1 45%' }} disabled={isDead || myPlayer.coins < 3 || myPlayer.coins >= 10 || isProcessing} className="gold" onClick={() => handleActionClick("Assassinate")}>Assassin (-3)</button>
            <button style={{ flex: '1 1 45%' }} disabled={isDead || myPlayer.coins >= 10 || isProcessing} className="gold" onClick={() => performAction("Steal")}>Captain (Steal)</button>
            <button style={{ flex: '1 1 45%' }} disabled={isDead || myPlayer.coins >= 10 || isProcessing} className="gold" onClick={() => performAction("Exchange")}>Ambassador (สลับไพ่)</button>
          </div>
        )}

      </div>
    </div>
  );
}