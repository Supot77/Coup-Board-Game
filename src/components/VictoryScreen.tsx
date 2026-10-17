import Modal from './Modal';

export default function VictoryScreen({ winnerName, isAdmin, onAdminReset, onClose }: {
  winnerName: string; isAdmin: boolean; onAdminReset: () => void; onClose: () => void;
}) {
  return <Modal title="ผลการชิงอำนาจ" onClose={onClose}>
    <div className="victory-summary">
      <span className="text-5xl" aria-hidden="true">👑</span>
      <p>ผู้ชนะ</p>
      <h2>{winnerName || 'ไม่ทราบชื่อ'}</h2>
      {isAdmin ? <button className="action-choice" onClick={onAdminReset}>กลับล็อบบี้เพื่อเริ่มเกมใหม่</button>
        : <p className="muted-copy">รอเจ้าของห้องเริ่มเกมรอบใหม่</p>}
      <p className="muted-copy">ปิดเพื่อดูผู้เล่นและประวัติ แล้วกด “ดูผลเกม” เพื่อเปิดอีกครั้ง</p>
    </div>
  </Modal>;
}
