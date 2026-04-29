import React, { useEffect } from 'react';
import './RulesModal.css';

export default function RulesModal({ onClose }) {
  // ปิด Modal เมื่อกดปุ่ม ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="rules-overlay" onClick={onClose}>
      {/* ใส่ e.stopPropagation() เพื่อไม่ให้การคลิกข้างในกรอบไปทริกเกอร์ onClose ของ overlay */}
      <div className="rules-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="rules-header">
          <h2 className="rules-title">📖 โพยสภาลับ (Rules)</h2>
          <button className="rules-close-btn" onClick={onClose}>✖</button>
        </div>

        {/* Content */}
        <div className="rules-content">
          
          <div className="rule-section">
            <h3 className="rule-section-title">🎯 เป้าหมายของเกม (Objective)</h3>
            <p style={{ margin: 0 }}>
              ผู้เล่นทุกคนจะเริ่มต้นด้วย <b>2 เหรียญ (Coins)</b> และ <b>2 อิทธิพล (ไพ่คว่ำหน้า)</b><br/>
              เป้าหมายของคุณคือการ <b>อยู่รอดเป็นคนสุดท้าย</b> โดยการใช้ Action หลอกลวง ลอบสังหาร หรือรัฐประหาร เพื่อทำลายอิทธิพล (บังคับเปิดไพ่) ของผู้เล่นคนอื่นให้หมด
            </p>
          </div>

          <div className="rule-section">
            <h3 className="rule-section-title">⚡ การลงมือ (General Actions)</h3>
            <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li><b style={{ color: '#d4af37' }}>Income (รายได้):</b> รับ 1 เหรียญ <i>(บล็อกไม่ได้)</i></li>
              <li><b style={{ color: '#93c5fd' }}>Foreign Aid (เงินช่วยเหลือ):</b> รับ 2 เหรียญ <i>(Duke สามารถบล็อกได้)</i></li>
              <li><b style={{ color: '#fca5a5' }}>Coup (รัฐประหาร):</b> จ่าย 7 เหรียญ เลือกทำลายอิทธิพล 1 ใบของผู้เล่นอื่น <i>(บล็อกไม่ได้ / ถ้ามีถึง 10 เหรียญในตาตัวเอง จะถูกบังคับให้ต้อง Coup)</i></li>
            </ul>
          </div>

          <div className="rule-section">
            <h3 className="rule-section-title">🎭 พลังตัวละคร (Character Abilities)</h3>
            <p style={{ fontSize: '13px', color: '#888', marginTop: 0 }}>*คุณสามารถอ้างว่าตัวเองมีไพ่ใบไหนก็ได้เพื่อใช้พลัง (Bluffing)</p>
            
            <div className="char-grid">
              <div className="char-item duke">
                <span className="char-name">Duke (ดยุก)</span>
                <span style={{ fontSize: '13px' }}><b>Action:</b> รับ 3 เหรียญ (Tax)<br/><b>Block:</b> บล็อก Foreign Aid ได้</span>
              </div>
              <div className="char-item assassin">
                <span className="char-name">Assassin (มือสังหาร)</span>
                <span style={{ fontSize: '13px' }}><b>Action:</b> จ่าย 3 เหรียญ ลอบสังหารผู้เล่นอื่นให้เสีย 1 อิทธิพล</span>
              </div>
              <div className="char-item captain">
                <span className="char-name">Captain (กัปตัน)</span>
                <span style={{ fontSize: '13px' }}><b>Action:</b> ปล้น 2 เหรียญจากผู้เล่น<br/><b>Block:</b> บล็อกการปล้นจาก Captain คนอื่น</span>
              </div>
              <div className="char-item ambassador">
                <span className="char-name">Ambassador (ทูต)</span>
                <span style={{ fontSize: '13px' }}><b>Action:</b> จั่วไพ่กองกลาง 2 ใบ มาเลือกสลับกับไพ่ในมือ<br/><b>Block:</b> บล็อกการปล้นจาก Captain ได้</span>
              </div>
              <div className="char-item contessa">
                <span className="char-name">Contessa (เคาน์เตส)</span>
                <span style={{ fontSize: '13px' }}><b>Block เท่านั้น:</b> บล็อกการลอบสังหารจาก Assassin ได้</span>
              </div>
            </div>
          </div>

          <div className="rule-section" style={{ marginBottom: 0 }}>
            <h3 className="rule-section-title">🚨 การจับโกหก (Challenge)</h3>
            <p style={{ margin: 0 }}>
              เมื่อผู้เล่นคนใดประกาศใช้พลังตัวละคร หรือประกาศบล็อก ผู้เล่นคนอื่นสามารถขัดจังหวะด้วยการ <b>"Challenge (จับโกหก)"</b> ได้ทันที
            </p>
            <ul style={{ paddingLeft: '20px', margin: '8px 0 0 0', color: '#fca5a5' }}>
              <li><b>ถ้าคนถูกจับโกหก "ไม่มีไพ่ใบนั้นจริง":</b> คนโกหกต้องเสียอิทธิพล 1 ใบ</li>
              <li><b style={{ color: '#6ee7b7' }}>แต่ถ้าคนถูกจับโกหก "มีไพ่ใบนั้นจริง":</b> เขาจะโชว์ไพ่ให้ดู (แล้วเอาไปสับกองกลางจั่วใบใหม่) และ <b>คนจับโกหกพลาดจะต้องเสียอิทธิพล 1 ใบแทน!</b></li>
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
}