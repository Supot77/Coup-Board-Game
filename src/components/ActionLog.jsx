import React, { useEffect, useRef } from 'react';

export default function ActionLog({ historyLog, gameState, alivePlayers, roomData }) {
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [historyLog]);

  return (
    // 🌟 1. เพิ่ม maxHeight เพื่อจำกัดความสูงของกรอบฝั่งซ้ายล่าง
    <div className="bg-[rgba(0,0,0,0.2)] rounded-[12px] p-[20px] flex flex-col flex-1 max-h-[450px]">
      <h3 className="text-gold m-0 mb-[10px]">📜 ประวัติการกระทำ</h3>
      
      {/* 🌟 2. history-log-box จะมี Scrollbar อัตโนมัติเมื่อข้อความล้น */}
      <div className="history-log-box overflow-y-auto flex-1 pr-[10px]">
        {historyLog.map((log, i) => (
          <p key={i} className="log-text">{log.text}</p>
        ))}
        <div ref={logEndRef} />
      </div>

      {(gameState === "waiting_for_responses" || gameState === "waiting_for_block_responses") && (
        <div className="mt-[15px] p-[15px] bg-[rgba(255,255,255,0.05)] rounded-[8px]">
          <h4 className="m-0 mb-[10px] text-gold">สถานะการโหวตของทุกคน:</h4>
          <div className="flex gap-[10px] flex-wrap">
            {alivePlayers.filter(p => 
              (gameState === "waiting_for_responses" && p.id !== roomData.pendingAction?.sourceId) ||
              (gameState === "waiting_for_block_responses" && p.id !== roomData.pendingAction?.blockerId)
            ).map(p => {
              const hasVoted = roomData.passVotes?.includes(p.id);
              return (
                <span key={p.id} className={`text-[14px] px-[12px] py-[5px] rounded-[15px] font-bold border ${hasVoted ? 'bg-[rgba(46,204,113,0.2)] border-[#2ecc71]' : 'bg-[rgba(241,196,15,0.2)] border-[#f1c40f]'}`}>
                  {p.name}: {hasVoted ? '✅ ยอมแล้ว' : '⏳ กำลังคิด'}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  );
}