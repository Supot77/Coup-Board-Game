import React from 'react';

export default function VictoryScreen({ winnerName, isAdmin, onAdminReset }: { winnerName: string; isAdmin: boolean; onAdminReset: () => void }) {
  return (
    <div className="fixed inset-0 w-screen h-screen victory-bg z-[10000] flex items-center justify-center">
      <div className="absolute inset-0 w-full h-full victory-overlay-gradient flex items-center justify-center">
        
        <div className="text-center victory-content-glow backdrop-blur-md p-[60px_40px] rounded-[20px] w-[90%] max-w-[650px] relative overflow-hidden animate-pop-in-epic">
          <div className="text-[70px] mb-[15px] drop-shadow-[0_0_15px_rgba(212,175,55,0.6)] animate-float-crown">👑</div>
          <h1 className="font-cinzel text-[#e2e0e8] text-[24px] tracking-[6px] m-[0_0_15px_0] uppercase">ผู้ครองบัลลังก์</h1>
          
          {/* ชื่อผู้ชนะจะเรืองแสงสีทองและกระพริบช้าๆ */}
          <h2 className="font-cinzel text-dark-gold text-[56px] font-black m-[0_0_20px_0] tracking-[2px] animate-pulse-glow-text">{winnerName || "ไม่ทราบชื่อ"}</h2>
          
          <p className="text-[#a0a0a0] text-[16px] mb-[45px] leading-[1.5]">
            ศัตรูถูกโค่นล้มจนหมดสิ้น<br/>
            อำนาจการปกครองทั้งหมดตกเป็นของคุณแต่เพียงผู้เดียว
          </p>

          {/* ปุ่มเริ่มเกมใหม่จะแสดงเฉพาะ Admin เท่านั้น */}
          {isAdmin ? (
            <button className="bg-[linear-gradient(135deg,rgba(212,175,55,0.15),rgba(0,0,0,0.4))] border border-dark-gold text-dark-gold font-thai text-[18px] font-bold py-[16px] px-[40px] rounded-[8px] cursor-pointer transition-all duration-300 tracking-[1px] hover:bg-[rgba(212,175,55,0.3)] hover:shadow-[0_0_25px_rgba(212,175,55,0.5)] hover:-translate-y-[3px] hover:text-white" onClick={onAdminReset}>
              กลับสู่โถงสภาเพื่อเริ่มยุคใหม่
            </button>
          ) : (
            <p className="text-[#888] italic text-[16px] animate-pulse-text">กำลังรอผู้คุมกฎ (Admin) เริ่มการชิงอำนาจรอบใหม่...</p>
          )}
        </div>

      </div>
    </div>
  );
}