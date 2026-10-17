import React, { useEffect, useRef } from 'react';

interface ActionLogProps {
  historyLog: any[];
  gameState: string;
  alivePlayers: any[];
  roomData: any;
}

export default function ActionLog({ historyLog, gameState, alivePlayers, roomData }: ActionLogProps) {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = logEndRef.current?.parentElement;
    if (box) box.scrollTop = box.scrollHeight;
  }, [historyLog]);

  return (
    // 🌟 1. เพิ่ม maxHeight เพื่อจำกัดความสูงของกรอบฝั่งซ้ายล่าง
    <div className="game-log game-panel flex flex-col">
      <h3 className="text-gold m-0 mb-[10px]">📜 ประวัติการกระทำ</h3>
      
      {/* 🌟 2. history-log-box จะมี Scrollbar อัตโนมัติเมื่อข้อความล้น */}
      <div className="history-log-box overflow-y-auto max-h-[50dvh] pr-[10px]">
        {historyLog.map((log, i) => (
          <p key={i} className="log-text">{log.text}</p>
        ))}
        <div ref={logEndRef} />
      </div>

      {(gameState === "waiting_for_responses" || gameState === "waiting_for_block_responses") && (
        <div className="mt-[15px] p-[15px] bg-[rgba(255,255,255,0.05)] rounded-[8px]">
          <h4 className="m-0 mb-[10px] text-gold">ผู้เล่นที่ต้องตอบ:</h4>
          <div className="flex gap-[10px] flex-wrap">
            {alivePlayers.filter(p => 
              (gameState === "waiting_for_responses" && p.id !== roomData.pendingAction?.sourceId) ||
              (gameState === "waiting_for_block_responses" && p.id !== roomData.pendingAction?.blockerId)
            ).map(p => {
              const hasVoted = roomData.passVotes?.includes(p.id);
              return (
                <span key={p.id} className={`text-[14px] px-[12px] py-[5px] rounded-[15px] font-bold border ${hasVoted ? 'bg-[rgba(46,204,113,0.2)] border-[#2ecc71]' : 'bg-[rgba(241,196,15,0.2)] border-[#f1c40f]'}`}>
                  {p.name}: {hasVoted ? 'ปล่อยผ่าน' : 'รอตอบ'}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  );
}
