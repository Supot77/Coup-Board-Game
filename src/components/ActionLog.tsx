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
    <section className="game-log game-panel" aria-label="ประวัติการกระทำ">
      <h2 className="panel-heading">ประวัติ <span>{historyLog.length} เหตุการณ์</span></h2>
      <div className="history-log-box">
        {historyLog.length === 0 && <p className="log-empty">เหตุการณ์จะแสดงที่นี่เมื่อมีผู้เล่นทำแอคชั่น</p>}
        {historyLog.map((log, i) => (
          <p key={i} className="log-text">{log.text}</p>
        ))}
        <div ref={logEndRef} />
      </div>

      {(gameState === "waiting_for_responses" || gameState === "waiting_for_block_responses") && (
        <div className="log-responses">
          <h3>ผู้เล่นที่ต้องตอบ</h3>
          <div className="log-response-list">
            {alivePlayers.filter(p => 
              (gameState === "waiting_for_responses" && p.id !== roomData.pendingAction?.sourceId) ||
              (gameState === "waiting_for_block_responses" && p.id !== roomData.pendingAction?.blockerId)
            ).map(p => {
              const hasVoted = roomData.passVotes?.includes(p.id);
              return (
                <span key={p.id} className={`log-response ${hasVoted ? 'has-passed' : 'is-waiting'}`}>
                  {p.name}: {hasVoted ? 'ปล่อยผ่าน' : 'รอตอบ'}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </section>
  );
}
