import React from 'react';
import './VictoryScreen.css'; // อย่าลืม import CSS ตัวใหม่

export default function VictoryScreen({ winnerName, isAdmin, onAdminReset }) {
  return (
    <div className="victory-wrapper">
      <div className="victory-overlay">
        
        <div className="victory-content animate-pop-in-epic">
          <div className="crown-icon">👑</div>
          <h1 className="victory-title">ผู้ครองบัลลังก์</h1>
          
          {/* ชื่อผู้ชนะจะเรืองแสงสีทองและกระพริบช้าๆ */}
          <h2 className="winner-name">{winnerName || "ไม่ทราบชื่อ"}</h2>
          
          <p className="victory-subtitle">
            ศัตรูถูกโค่นล้มจนหมดสิ้น<br/>
            อำนาจการปกครองทั้งหมดตกเป็นของคุณแต่เพียงผู้เดียว
          </p>

          {/* ปุ่มเริ่มเกมใหม่จะแสดงเฉพาะ Admin เท่านั้น */}
          {isAdmin ? (
            <button className="victory-btn" onClick={onAdminReset}>
              กลับสู่โถงสภาเพื่อเริ่มยุคใหม่
            </button>
          ) : (
            <p className="waiting-text">กำลังรอผู้คุมกฎ (Admin) เริ่มการชิงอำนาจรอบใหม่...</p>
          )}
        </div>

      </div>
    </div>
  );
}