import React, { useEffect, useRef } from 'react';

export default function ActionLog({ historyLog, gameState, alivePlayers, roomData }) {
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [historyLog]);

  return (
    // 🌟 1. เพิ่ม maxHeight เพื่อจำกัดความสูงของกรอบฝั่งซ้ายล่าง
    <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', flex: 1, maxHeight: '450px' }}>
      <h3 style={{ color: 'var(--gold)', margin: '0 0 10px 0' }}>📜 ประวัติการกระทำ</h3>
      
      {/* 🌟 2. history-log-box จะมี Scrollbar อัตโนมัติเมื่อข้อความล้น */}
      <div className="history-log-box" style={{ overflowY: 'auto', flex: 1, paddingRight: '10px' }}>
        {historyLog.map((log, i) => (
          <p key={i} className="log-text">{log.text}</p>
        ))}
        <div ref={logEndRef} />
      </div>

      {(gameState === "waiting_for_responses" || gameState === "waiting_for_block_responses") && (
        <div style={{ marginTop: '15px', padding: '15px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: 'var(--gold)' }}>สถานะการโหวตของทุกคน:</h4>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {alivePlayers.filter(p => 
              (gameState === "waiting_for_responses" && p.id !== roomData.pendingAction?.sourceId) ||
              (gameState === "waiting_for_block_responses" && p.id !== roomData.pendingAction?.blockerId)
            ).map(p => {
              const hasVoted = roomData.passVotes?.includes(p.id);
              return (
                <span key={p.id} style={{ fontSize: '14px', backgroundColor: hasVoted ? 'rgba(46, 204, 113, 0.2)' : 'rgba(241, 196, 15, 0.2)', padding: '5px 12px', borderRadius: '15px', border: `1px solid ${hasVoted ? '#2ecc71' : '#f1c40f'}`, fontWeight: 'bold' }}>
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