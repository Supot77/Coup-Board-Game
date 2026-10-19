import { useEffect, useRef, useState } from 'react';
import type { PublicGameEvent } from '../core/gameEvents';
import { timestampMillis } from '../core/responseTiming';

export default function ActionLog({ historyLog = [], events = [], gameState, alivePlayers, roomData, players = alivePlayers, error = '' }: {
  historyLog?: { text: string }[]; events?: PublicGameEvent[]; gameState: string; alivePlayers: any[]; roomData: any; players?: any[];
  error?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const previousCount = useRef(0);
  const [filter, setFilter] = useState('all');
  const [unread, setUnread] = useState(0);
  const shown = events.filter(event => filter === 'all' || [event.actorId, event.sourceId, event.targetId].includes(filter)
    || event.coinChanges.some(change => change.playerId === filter) || event.influenceChanges.some(change => change.playerId === filter));
  useEffect(() => {
    const count = events.length || historyLog.length;
    if (following.current && boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
    else if (count > previousCount.current) { const difference = count - previousCount.current; setUnread(value => value + difference); }
    previousCount.current = count;
  }, [events, historyLog]);
  const jump = () => {
    following.current = true; setUnread(0);
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  };
  return <section className="game-log game-panel" aria-label="ประวัติการกระทำ">
    <h2 className="panel-heading">ประวัติ <span>{events.length || historyLog.length} เหตุการณ์</span></h2>
    {error && <p className="history-partial" role="status">โหลดประวัติยังไม่สำเร็จ · {error}</p>}
    {events.length > 0 && <label className="history-filter">ดูเหตุการณ์ของ<select aria-label="กรองประวัติตามผู้เล่น" value={filter} onChange={event => { setFilter(event.target.value); following.current = true; setUnread(0); }}>
      <option value="all">ทุกคน</option>{players.map(player => <option key={player.id} value={player.id}>{player.name}</option>)}
    </select></label>}
    {(!roomData.roundId || roomData.historyStartedMidRound) && <p className="history-partial">รอบเดิมนี้มีประวัติเฉพาะที่บันทึกได้หลังเปิดห้อง</p>}
    <div className="history-log-box" ref={boxRef} tabIndex={0} aria-label="รายการเหตุการณ์" onScroll={() => {
      const box = boxRef.current;
      following.current = !!box && box.scrollHeight - box.scrollTop - box.clientHeight < 48;
      if (following.current) setUnread(0);
    }}>
      {!events.length && !historyLog.length && <p className="log-empty">เหตุการณ์จะแสดงที่นี่เมื่อมีผู้เล่นทำแอคชั่น</p>}
      {events.length ? <ol className="public-event-list">{shown.map(event => {
        const at = timestampMillis(event.at);
        const elapsed = at === null || !roomData.gameStartedAt ? null : Math.max(0, Math.floor((at - roomData.gameStartedAt) / 1000));
        return <li className="log-text public-event" key={event.id ?? event.sequence} data-kind={event.kind}>
          <div><b>ตา {event.turnNumber}</b>{elapsed !== null && <time>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</time>}</div>
          <p>{event.outcome}</p>
          {event.coinChanges.length > 0 && <small>{event.coinChanges.map(change => `${change.playerName} ${change.after > change.before ? '+' : ''}${change.after - change.before} เหรียญ`).join(' · ')}</small>}
        </li>;
      })}</ol> : historyLog.map((log, index) => <p key={index} className="log-text">{log.text}</p>)}
      {events.length > 0 && !shown.length && <p className="log-empty">ยังไม่มีเหตุการณ์ของผู้เล่นนี้</p>}
    </div>
    {unread > 0 && <button className="utility-button history-new-events" onClick={jump}>เหตุการณ์ใหม่ {unread} รายการ ↓</button>}
    {['waiting_for_responses', 'waiting_for_block_responses'].includes(gameState) && <div className="log-responses">
      <h3>ผู้เล่นที่ต้องตอบ</h3><div className="log-response-list">{alivePlayers.filter(player => player.id !== (gameState === 'waiting_for_responses' ? roomData.pendingAction?.sourceId : roomData.pendingAction?.blockerId)).map(player => {
        const passed = roomData.passVotes?.includes(player.id);
        return <span key={player.id} className={`log-response ${passed ? 'has-passed' : 'is-waiting'}`}>{player.name}: {passed ? 'ปล่อยผ่าน' : 'รอตอบ'}</span>;
      })}</div>
    </div>}
  </section>;
}
