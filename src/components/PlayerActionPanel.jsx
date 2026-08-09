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
    <div className="flex flex-col h-full gap-[15px]">
      
      {/* ================= โซน YOUR INFLUENCE ================= */}
      <div className={`bg-white/[0.03] border border-white/[0.06] rounded-[20px] relative box-border pulse-glow transition-smooth flex flex-col justify-center items-center ${needsActionSpace ? 'flex-[0_1_auto] p-[15px]' : 'flex-1 p-5'}`}>
        <div className="text-[#d4af37] text-xs uppercase tracking-[2px] font-semibold flex items-center gap-2 absolute top-[15px] left-[15px]">👤 YOUR INFLUENCE</div>
        
        <div className={`text-center transition-all duration-300 ${needsActionSpace ? 'mb-[10px]' : 'mb-[20px]'}`}>
          <div className={`font-bold transition-all duration-300 ${needsActionSpace ? 'text-[14px] mb-[5px]' : 'text-[16px] mb-[10px]'}`} style={{ color: statusColor }}>
            {statusText}
          </div>
          {!isDead && timeLeft !== null && (
            <div className={`text-[14px] ${timeLeft <= 5 ? 'text-[#ef4444]' : 'text-[#d4af37]'} ${needsActionSpace ? 'mb-[5px]' : 'mb-[15px]'}`}>
              ⏳ เวลาตัดสินใจ: {timeLeft} วิ
            </div>
          )}
          {/* โค้ดใหม่ที่ถูกต้อง */}
          <div className={`text-[#d4af37] font-black transition-all duration-300 flex items-center justify-center gap-2 ${needsActionSpace ? 'text-[24px]' : 'text-[32px]'}`}>
            <span className={`animate-coin-glow ${needsActionSpace ? 'text-[22px]' : 'text-[28px]'}`}>🪙</span> {myPlayer?.coins} Coins
          </div>
        </div>

        <div className="flex gap-5 transition-all duration-400">
          {myPlayer?.cards?.map((c, i) => (
            <div key={i} className={`rounded-[15px] border border-[rgba(212,175,55,0.3)] shadow-[0_10px_20px_rgba(0,0,0,0.5)] transition-smooth bg-cover bg-center flex items-end justify-center p-[15px] w-[140px] h-[200px] ${c.isDead ? 'opacity-30 grayscale' : 'opacity-100 grayscale-0'}`} style={{ 
              backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.9)), url(${cardImages[c.character] || ''})`
            }}>
              <span className={`text-[#d4af37] font-bold font-cinzel text-[18px] [text-shadow:2px_2px_4px_black] transition-all duration-400 ${c.isDead ? 'line-through' : 'no-underline'}`}>{c.character}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ================= โซน ACTIONS & RESPONSES ================= */}
      <div className={`bg-white/[0.03] border border-white/[0.06] rounded-[20px] p-5 relative box-border transition-smooth flex flex-col ${needsActionSpace ? 'flex-1 overflow-y-auto' : 'flex-[0_1_auto] min-h-[100px]'}`}>
        <div className="text-[#888] text-xs uppercase tracking-[2px] font-semibold mb-4 flex items-center gap-2">⚔️ ACTIONS</div>
        
        <div className="h-full flex items-center justify-center">
          {/* 1. กล่องยืนยันการทำ Action */}
          {actionToConfirm ? (
            <div className="text-center w-full">
               <h3 className="text-[#e2e0e8] mt-0">ยืนยันการใช้ {actionToConfirm}?</h3>
               <p className="text-[#888] text-[14px]">คุณจะเสีย {actionToConfirm === "Coup" ? 7 : 3} เหรียญทันที</p>
               <div className="flex justify-center gap-[15px] mt-[20px]">
                 <button className="bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] text-[#d4af37] rounded-full text-[13px] font-medium flex items-center gap-2 transition-fast !bg-[rgba(16,185,129,0.2)] !text-[#34d399] !border-[rgba(16,185,129,0.5)] py-[12px] px-[30px] cursor-pointer" disabled={isDead || isProcessing} onClick={() => { performAction(actionToConfirm); setActionToConfirm(null); }}>✅ ยืนยัน</button>
                 <button className="bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] text-[#d4af37] rounded-full text-[13px] font-medium flex items-center gap-2 transition-fast !bg-[rgba(239,68,68,0.1)] !text-[#fca5a5] !border-[rgba(239,68,68,0.4)] py-[12px] px-[30px] cursor-pointer" disabled={isDead || isProcessing} onClick={() => setActionToConfirm(null)}>❌ ยกเลิก</button>
               </div>
            </div>
          ) : 

          /* 2. กล่องเลือกเป้าหมาย */
          targetAction ? (
            <div className="text-center w-full">
              <h3 className="text-[#d4af37] mt-0">🎯 เลือกเป้าหมาย: {targetAction}</h3>
              <div className="flex flex-wrap justify-center gap-[10px] mt-[15px]">
                {alivePlayers.filter(p => p.id !== userToken).map(p => (
                  <button key={p.id} className="relative bg-white/[0.03] border border-white/[0.08] rounded-xl text-white min-w-[130px] cursor-pointer transition-smooth overflow-hidden flex-none w-auto py-[10px] px-[20px] text-center" disabled={isDead || isProcessing} onClick={() => handleTargetSelect(p.id)}>
                    {p.name}
                  </button>
                ))}
              </div>
              <button className="bg-transparent text-[#f87171] border-none mt-[20px] underline cursor-pointer" disabled={isDead || isProcessing} onClick={() => setTargetAction(null)}>ยกเลิกการเลือก</button>
            </div>
          ) : 

          /* 3. กรณีมี Action เกิดขึ้น (แสดงข้อความชั่วคราวบนกล่องหลัก เพราะป๊อปอัปจะเด้งทับแล้ว) */
          (gameState === "waiting_for_responses" || gameState === "waiting_for_block_responses") ? (
            <div className="text-[#666] italic p-[20px] text-center">
              โปรดดูหน้าต่างแจ้งเตือนกลางหน้าจอ...
            </div>
          ) : 

          /* 4. กล่องบังคับทิ้งไพ่ */
          gameState === "waiting_for_discard" && roomData.discardTarget === userToken ? (
            <div className="text-center w-full">
              <h3 className="mt-0 text-[#fca5a5] text-[16px]">💀 เลือกไพ่ที่จะทิ้ง</h3>
              <div className="flex justify-center gap-[15px] mt-[15px]">
                {myPlayer.cards.map((c, i) => !c.isDead && (
                  <button key={i} className="relative bg-white/[0.03] border border-white/[0.08] rounded-xl text-white min-w-[130px] cursor-pointer transition-smooth overflow-hidden flex-none w-[130px] text-center !border-[#ef4444] py-[10px] px-[14px]" disabled={isDead || isProcessing} onClick={() => submitDiscard(i)}>
                    ทิ้ง {c.character}
                  </button>
                ))}
              </div>
            </div>
          ) : 

          /* 5. กล่องเลือกสลับไพ่ (Ambassador) */
          gameState === "waiting_for_exchange" && isMyTurn ? (
            <div className="text-center w-full">
              <h3 className="text-[#d4af37] mt-0 text-[16px]">🔄 เลือกไพ่ที่จะเก็บไว้ {myPlayer.cards.filter(c => !c.isDead).length} ใบ</h3>
              <div className="flex gap-[10px] justify-center flex-wrap my-[15px]">
                {[...myPlayer.cards.filter(c => !c.isDead), ...(roomData.drawnCards || [])].map((c, i) => {
                  const isSelected = selectedAmbassadorCards.includes(i);
                  return (
                    <div key={i} onClick={() => !isProcessing && handleToggleExchangeCard(i)} 
                      className={`w-[85px] h-[125px] rounded-[8px] cursor-pointer transition-[0.2s] bg-cover bg-center relative ${isSelected ? 'border-[3px] border-[#d4af37] -translate-y-[10px]' : 'border border-[rgba(255,255,255,0.2)]'}`}
                      style={{ backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.8)), url(${cardImages[c.character]})` }}>
                      <div className="absolute bottom-0 w-full py-[4px] text-[11px] font-bold text-white text-center">{c.character}</div>
                      {isSelected && <div className="absolute -top-[8px] -right-[8px] bg-[#d4af37] text-black rounded-full w-[22px] h-[22px] flex items-center justify-center font-bold">✓</div>}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-center">
                <button className="bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] text-[#d4af37] rounded-full text-[13px] font-medium flex items-center gap-2 transition-fast !bg-[rgba(16,185,129,0.2)] !text-[#34d399] !border-[#10b981] cursor-pointer w-[200px] justify-center p-[10px]" 
                  disabled={isProcessing || selectedAmbassadorCards.length !== myPlayer.cards.filter(c => !c.isDead).length} 
                  onClick={confirmExchange}>
                  ยืนยันการสลับไพ่
                </button>
              </div>
            </div>
          ) : 

          /* 6. แผงปุ่ม Actions หลัก */
          isMyTurn && !isDead && gameState === "waiting_for_action" ? (
            <div className="flex flex-wrap gap-2 p-[5px] w-full">
              <button className="relative bg-white/[0.03] border border-white/[0.08] rounded-xl py-[10px] px-[14px] text-left text-white flex-[1_1_calc(33.33%-8px)] min-w-[130px] cursor-pointer transition-smooth overflow-hidden border-l-4 border-l-[#d4af37]" disabled={myPlayer.coins >= 10 || isProcessing} onClick={() => performAction("Income")}>
                <div className="flex justify-between items-center mb-[2px]"><b className="text-[15px] tracking-[0.5px]">Income</b><span className="text-[13px] font-bold py-[2px] px-[6px] rounded-md bg-black/30 text-[#d4af37]">+1 💰</span></div>
                <small className="block text-[10px] text-white/40 font-light">รับรายได้พื้นฐาน</small>
              </button>
              <button className="relative bg-white/[0.03] border border-white/[0.08] rounded-xl py-[10px] px-[14px] text-left text-white flex-[1_1_calc(33.33%-8px)] min-w-[130px] cursor-pointer transition-smooth overflow-hidden border-l-4 border-l-[#6366f1]" disabled={myPlayer.coins >= 10 || isProcessing} onClick={() => performAction("ForeignAid")}>
                <div className="flex justify-between items-center mb-[2px]"><b className="text-[15px] tracking-[0.5px]">Foreign Aid</b><span className="text-[13px] font-bold py-[2px] px-[6px] rounded-md bg-black/30 text-[#93c5fd]">+2 💰</span></div>
                <small className="block text-[10px] text-white/40 font-light">รับเงินช่วยเหลือ (Duke บล็อกได้)</small>
              </button>
              <button className="relative bg-white/[0.03] border border-white/[0.08] rounded-xl py-[10px] px-[14px] text-left text-white flex-[1_1_calc(33.33%-8px)] min-w-[130px] cursor-pointer transition-smooth overflow-hidden border-l-4 border-l-[#ef4444]" disabled={myPlayer.coins < 7 || isProcessing} onClick={() => handleActionClick("Coup")}>
                <div className="flex justify-between items-center mb-[2px]"><b className="text-[15px] tracking-[0.5px]">Coup</b><span className="text-[13px] font-bold py-[2px] px-[6px] rounded-md bg-black/30 text-[#fca5a5]">-7 💰</span></div>
                <small className="block text-[10px] text-white/40 font-light">โค่นล้มอิทธิพลคู่แข่ง</small>
              </button>
              <button className="relative bg-white/[0.03] border border-white/[0.08] rounded-xl py-[10px] px-[14px] text-left text-white flex-[1_1_calc(33.33%-8px)] min-w-[130px] cursor-pointer transition-smooth overflow-hidden border-l-4 border-l-[#8b5cf6]" disabled={myPlayer.coins >= 10 || isProcessing} onClick={() => performAction("Tax")}>
                <div className="flex justify-between items-center mb-[2px]"><b className="text-[15px] tracking-[0.5px]">Tax (Duke)</b><span className="text-[13px] font-bold py-[2px] px-[6px] rounded-md bg-black/30 text-[#c4b5fd]">+3 💰</span></div>
                <small className="block text-[10px] text-white/40 font-light">เก็บภาษีจากกองกลาง</small>
              </button>
              <button className="relative bg-white/[0.03] border border-white/[0.08] rounded-xl py-[10px] px-[14px] text-left text-white flex-[1_1_calc(33.33%-8px)] min-w-[130px] cursor-pointer transition-smooth overflow-hidden border-l-4 border-l-[#ef4444]" disabled={myPlayer.coins < 3 || myPlayer.coins >= 10 || isProcessing} onClick={() => handleActionClick("Assassinate")}>
                <div className="flex justify-between items-center mb-[2px]"><b className="text-[15px] tracking-[0.5px]">Assassinate</b><span className="text-[13px] font-bold py-[2px] px-[6px] rounded-md bg-black/30 text-[#fca5a5]">-3 💰</span></div>
                <small className="block text-[10px] text-white/40 font-light">ลอบสังหาร (Contessa บล็อกได้)</small>
              </button>
              <button className="relative bg-white/[0.03] border border-white/[0.08] rounded-xl py-[10px] px-[14px] text-left text-white flex-[1_1_calc(33.33%-8px)] min-w-[130px] cursor-pointer transition-smooth overflow-hidden border-l-4 border-l-[#3b82f6]" disabled={myPlayer.coins >= 10 || isProcessing} onClick={() => performAction("Steal")}>
                <div className="flex justify-between items-center mb-[2px]"><b className="text-[15px] tracking-[0.5px]">Steal (Captain)</b><span className="text-[13px] font-bold py-[2px] px-[6px] rounded-md bg-black/30 text-[#93c5fd]">ขโมย 2 💰</span></div>
                <small className="block text-[10px] text-white/40 font-light">ปล้นเงินจากผู้เล่นอื่น</small>
              </button>
              <button className="relative bg-white/[0.03] border border-white/[0.08] rounded-xl py-[10px] px-[14px] text-left text-white flex-[1_1_calc(33.33%-8px)] min-w-[130px] cursor-pointer transition-smooth overflow-hidden border-l-4 border-l-[#10b981] !flex-[1_1_100%]" disabled={myPlayer.coins >= 10 || isProcessing} onClick={() => performAction("Exchange")}>
                <div className="flex justify-between items-center mb-[2px]"><b className="text-[15px] tracking-[0.5px]">Exchange</b><span className="text-[13px] font-bold py-[2px] px-[6px] rounded-md bg-black/30 text-[#6ee7b7]">สลับไพ่</span></div>
                <small className="block text-[10px] text-white/40 font-light">แลกเปลี่ยนตัวละครกับกองกลาง (Ambassador)</small>
              </button>
            </div>
          ) : (
            <div className="text-[#666] italic p-[20px]">กำลังรอเหตุการณ์ถัดไป...</div>
          )}
        </div>
      </div>

      {/* ================= 🚨 ACTION POPUP OVERLAY (เด้งขึ้นมาเมื่อมีแอคชั่น) ================= */}
      {(gameState === "waiting_for_responses" || gameState === "waiting_for_block_responses") && (
        <div className="fixed inset-0 w-screen h-screen bg-black/65 backdrop-blur-[6px] flex items-center justify-center z-[10000] animate-fade-in">
          <div className={`action-popup-bg rounded-[20px] p-[35px_25px] w-[90%] max-w-[550px] text-center animate-pop-in ${gameState === "waiting_for_block_responses" ? "border-2 border-[rgba(59,130,246,0.5)] shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_40px_rgba(59,130,246,0.15)]" : "border-2 border-[rgba(239,68,68,0.5)] shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_40px_rgba(239,68,68,0.15)]"}`}>
            
            <div className="text-[45px] mb-[15px]">{gameState === "waiting_for_responses" ? "⚠️" : "🛡️"}</div>
            <h2 className="text-white m-[0_0_20px_0] font-outfit tracking-[1px]">
              {gameState === "waiting_for_responses" ? "มีการประกาศใช้ Action!" : "มีการประกาศ Block!"}
            </h2>

            {/* ส่วนแจ้งรายละเอียดว่าใครทำอะไรใส่ใคร แบบเน้นสีจัดจ้าน */}
            <div className="bg-black/40 p-5 rounded-xl mb-[25px] leading-[1.8] border border-white/[0.05]">
              {gameState === "waiting_for_responses" ? (
                <>
                  <span className="text-[#f1c40f] font-bold text-[18px]">{sourcePlayer?.name}</span>
                  <span className="text-[#e2e0e8] text-[16px]"> ประกาศใช้ </span>
                  <span className="bg-[rgba(239,68,68,0.2)] text-[#fca5a5] py-1 px-[10px] rounded-md font-bold text-[18px] border border-[rgba(239,68,68,0.4)] mx-[6px] inline-block">{roomData.pendingAction.actionName}</span>
                  {targetPlayer && (
                    <>
                      <span className="text-[#e2e0e8] text-[16px]"> ใส่ </span>
                      <span className="text-[#f1c40f] font-bold text-[18px]">{targetPlayer.name}</span>
                    </>
                  )}
                </>
              ) : (
                <>
                  <span className="text-[#f1c40f] font-bold text-[18px]">{blockerPlayer?.name}</span>
                  <span className="text-[#e2e0e8] text-[16px]"> ประกาศบล็อก </span>
                  <span className="bg-[rgba(239,68,68,0.2)] text-[#fca5a5] py-1 px-[10px] rounded-md font-bold text-[18px] border border-[rgba(239,68,68,0.4)] mx-[6px] inline-block">{roomData.pendingAction.actionName}</span>
                  <span className="text-[#e2e0e8] text-[16px]"> ของ </span>
                  <span className="text-[#f1c40f] font-bold text-[18px]">{sourcePlayer?.name}</span>
                  <br/><span className="text-[#e2e0e8] text-[16px] inline-block mt-[8px]">โดยอ้างสิทธิ์ </span>
                  <span className="bg-[rgba(59,130,246,0.2)] text-[#93c5fd] py-1 px-[10px] rounded-md font-bold text-[18px] border border-[rgba(59,130,246,0.4)] mx-[6px] inline-block">{roomData.pendingAction.blockCharacter}</span>
                </>
              )}
            </div>

            {/* กล่องปุ่มกดตอบสนองด้านล่าง */}
            {isWaitingForMyResponse ? (
              <div>
                <p className="text-[#e2e0e8] m-[0_0_15px_0]">คุณจะตัดสินใจอย่างไร?</p>
                
                <div className="flex gap-[15px] justify-center flex-wrap">
                  <button className="bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] text-[#d4af37] rounded-full font-medium flex items-center gap-2 transition-fast !bg-[rgba(16,185,129,0.2)] !text-[#34d399] !border !border-[rgba(16,185,129,0.6)] !text-[16px] !py-[14px] !px-[35px]" disabled={isDead || isProcessing} onClick={handleVotePass}>
                    ✅ Allow (ปล่อยผ่าน)
                  </button>
                  <button className="bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] text-[#d4af37] rounded-full font-medium flex items-center gap-2 transition-fast !bg-[rgba(239,68,68,0.2)] !text-[#fca5a5] !border !border-[rgba(239,68,68,0.6)] !text-[16px] !py-[14px] !px-[35px]" disabled={isDead || isProcessing} onClick={handleChallenge}>
                    🚨 Challenge (จับโกหก)
                  </button>
                </div>

                {/* ปุ่ม Block พิเศษตามสถานการณ์ */}
                <div className="flex gap-[10px] justify-center mt-[15px]">
                  {gameState === "waiting_for_responses" && roomData.pendingAction.actionName === "ForeignAid" && <button className="bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] text-[#d4af37] rounded-full font-medium flex items-center gap-2 transition-fast !bg-[rgba(59,130,246,0.2)] !text-[#93c5fd] !border !border-[rgba(59,130,246,0.5)] !text-[14px] !py-[10px] !px-[20px]" disabled={isDead || isProcessing} onClick={() => handleBlock("Duke")}>🛡️ Block (Duke)</button>}
                  {gameState === "waiting_for_responses" && roomData.pendingAction.actionName === "Assassinate" && roomData.pendingAction.targetId === userToken && <button className="bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] text-[#d4af37] rounded-full font-medium flex items-center gap-2 transition-fast !bg-[rgba(59,130,246,0.2)] !text-[#93c5fd] !border !border-[rgba(59,130,246,0.5)] !text-[14px] !py-[10px] !px-[20px]" disabled={isDead || isProcessing} onClick={() => handleBlock("Contessa")}>🛡️ Block (Contessa)</button>}
                  {gameState === "waiting_for_responses" && roomData.pendingAction.actionName === "Steal" && roomData.pendingAction.targetId === userToken && (
                    <>
                      <button className="bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] text-[#d4af37] rounded-full font-medium flex items-center gap-2 transition-fast !bg-[rgba(59,130,246,0.2)] !text-[#93c5fd] !border !border-[rgba(59,130,246,0.5)] !text-[14px] !py-[10px] !px-[20px]" disabled={isDead || isProcessing} onClick={() => handleBlock("Captain")}>🛡️ Block (Captain)</button>
                      <button className="bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] text-[#d4af37] rounded-full font-medium flex items-center gap-2 transition-fast !bg-[rgba(59,130,246,0.2)] !text-[#93c5fd] !border !border-[rgba(59,130,246,0.5)] !text-[14px] !py-[10px] !px-[20px]" disabled={isDead || isProcessing} onClick={() => handleBlock("Ambassador")}>🛡️ Block (Ambassador)</button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-[#888] italic text-[16px] p-[10px]">
                ⏳ กำลังรอผู้เล่นอื่นตัดสินใจ...
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}