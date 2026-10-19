import Modal from './Modal';
import GameIcon from './GameIcon';
import { summarizeRound, type PublicGameEvent } from '../core/gameEvents';

export default function VictoryScreen({ winnerName, isAdmin, onAdminReset, onClose, events = [], room }: {
  winnerName: string; isAdmin: boolean; onAdminReset: () => void; onClose: () => void;
  events?: PublicGameEvent[]; room?: { gameStartedAt?: number; gameEndedAt?: number | null; turnNumber?: number; historyStartedMidRound?: boolean };
}) {
  const stats = summarizeRound(events, room?.gameEndedAt);
  const duration = room?.gameStartedAt && room?.gameEndedAt ? Math.max(0, Math.floor((room.gameEndedAt - room.gameStartedAt) / 1000)) : stats.durationSeconds;
  const complete = events.length > 0 && !room?.historyStartedMidRound;
  return <Modal title="ผลการชิงอำนาจ" onClose={onClose} className="victory-dialog">
    <div className="victory-summary">
      <p className="victory-edition">COUP <span>THE SECRET COUNCIL</span></p>
      <div className="victory-seal" aria-hidden="true">
        <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="60" cy="60" r="51" /><circle cx="60" cy="60" r="45" strokeDasharray="1 7" />
          <path d="m35 48 12 10 13-21 13 21 12-10-6 29H41l-6-29ZM43 84h34M47 69h26" />
          <circle cx="35" cy="44" r="3" /><circle cx="60" cy="33" r="3" /><circle cx="85" cy="44" r="3" />
        </svg>
      </div>
      <p className="victory-label">ผู้ชนะของสภา</p>
      <h2>{winnerName || 'ไม่ทราบชื่อ'}</h2>
      <p className="victory-description">ผู้เหลืออิทธิพลเป็นคนสุดท้าย</p>
      <dl className="victory-stats">
        <div><dt>เวลาเล่น</dt><dd>{duration === null ? '—' : `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`}</dd></div>
        <div><dt>จำนวนตา</dt><dd>{room?.turnNumber || (stats.turns || '—')}</dd></div>
        <div><dt>จับโกหกสำเร็จ</dt><dd>{complete ? stats.successfulChallenges : '—'}</dd></div>
      </dl>
      {!complete && <p className="muted-copy">รอบนี้มีข้อมูลไม่ครบ จึงไม่แสดงสถิติที่ยืนยันไม่ได้</p>}
      {events.length > 0 && <div className="victory-highlights"><h3>เหตุการณ์ท้ายเกม</h3><ol>{events.filter(event => !['start', 'pass'].includes(event.kind)).slice(-3).map(event => <li key={event.id ?? event.sequence}>{event.outcome}</li>)}</ol></div>}
      <div className="victory-actions">
        {isAdmin ? <button type="button" className="action-choice victory-rematch" onClick={onAdminReset}><GameIcon kind="reset" />กลับล็อบบี้เพื่อเริ่มเกมใหม่</button>
          : <p className="victory-waiting"><GameIcon kind="clock" />รอเจ้าของห้องเริ่มเกมรอบใหม่</p>}
        <button type="button" className="utility-button victory-review" onClick={onClose}><GameIcon kind="book" />ดูผู้เล่นและประวัติ</button>
      </div>
      <p className="victory-footnote">กด “ดูผลเกม” บนกระดานเพื่อเปิดผลอีกครั้ง</p>
    </div>
  </Modal>;
}
