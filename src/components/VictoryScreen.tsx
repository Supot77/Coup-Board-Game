import Modal from './Modal';
import GameIcon from './GameIcon';

export default function VictoryScreen({ winnerName, isAdmin, onAdminReset, onClose }: {
  winnerName: string; isAdmin: boolean; onAdminReset: () => void; onClose: () => void;
}) {
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
      <div className="victory-actions">
        {isAdmin ? <button type="button" className="action-choice victory-rematch" onClick={onAdminReset}><GameIcon kind="reset" />กลับล็อบบี้เพื่อเริ่มเกมใหม่</button>
          : <p className="victory-waiting"><GameIcon kind="clock" />รอเจ้าของห้องเริ่มเกมรอบใหม่</p>}
        <button type="button" className="utility-button victory-review" onClick={onClose}><GameIcon kind="book" />ดูผู้เล่นและประวัติ</button>
      </div>
      <p className="victory-footnote">กด “ดูผลเกม” บนกระดานเพื่อเปิดผลอีกครั้ง</p>
    </div>
  </Modal>;
}
