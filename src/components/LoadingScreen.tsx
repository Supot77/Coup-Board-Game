import { useEffect, useState, type CSSProperties } from 'react';

export default function LoadingScreen({ progress, message = 'กำลังเตรียมสภาลับ', detail }: {
  progress?: number;
  message?: string;
  detail?: string;
}) {
  const [slow, setSlow] = useState(false);
  const percent = progress === undefined ? undefined : Math.min(100, Math.max(0, Math.round(progress)));
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 15000);
    return () => window.clearTimeout(timer);
  }, []);
  return <section className={`sword-loading ${percent === undefined ? 'is-indeterminate' : ''}`} aria-label="หน้ารอโหลด" aria-busy={percent !== 100}>
    <div className="sword-loading-panel">
      <p className="sword-loading-brand">COUP <span>THE SECRET COUNCIL</span></p>
      <span className="sword-loading-emblem" aria-hidden="true">✦</span>
      <h1>{percent === 100 ? 'พร้อมเข้าเล่นแล้ว' : message}</h1>
      <p className="sword-loading-description">เตรียมพร้อมก่อนเริ่มเกมชิงอำนาจ</p>
      <div className="sword-progress" role="progressbar" aria-label={message} aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={percent} aria-valuetext={percent === undefined ? 'กำลังรอโหลด' : `${percent}%`}
        style={{ '--sword-progress': `${percent ?? 0}%` } as CSSProperties}>
        <div className="sword-progress-track"><span /></div>
        <span className="sword-progress-marker" aria-hidden="true"><img src="/assets/secret-council/loading-sword.webp" alt="" /></span>
      </div>
      <div className="sword-progress-caption"><span>{detail ?? 'กำลังโหลดส่วนที่จำเป็น'}</span><strong>{percent === undefined ? 'รอสักครู่' : `${percent}%`}</strong></div>
      <p className="sword-loading-hint" role="status">{slow && percent !== 100 ? 'ใช้เวลานานกว่าปกติ ลองตรวจการเชื่อมต่อของคุณ' : percent === 100 ? 'กำลังเปิดหน้าเกม…' : 'รอสักครู่ ระบบจะเปิดหน้าเกมเมื่อพร้อม'}</p>
      {slow && percent !== 100 && <button type="button" className="sword-loading-retry" onClick={() => window.location.reload()}>ลองโหลดใหม่</button>}
    </div>
  </section>;
}
