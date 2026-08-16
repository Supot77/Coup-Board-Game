import React, { useEffect } from 'react';

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
    <div className="fixed inset-0 w-screen h-screen bg-[rgba(0,0,0,0.75)] backdrop-blur-md flex items-center justify-center z-[9999] p-5 box-border animate-fade-in" onClick={onClose}>
      {/* ใส่ e.stopPropagation() เพื่อไม่ให้การคลิกข้างในกรอบไปทริกเกอร์ onClose ของ overlay */}
      <div className="rules-modal-bg border border-[rgba(212,175,55,0.3)] rounded-[24px] w-full max-w-[650px] max-h-[85vh] flex flex-col overflow-hidden relative animate-slide-up" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-[20px_24px] border-b border-[rgba(255,255,255,0.08)] flex justify-between items-center shrink-0 bg-[rgba(0,0,0,0.2)]">
          <h2 className="text-dark-gold font-cinzel text-[22px] font-bold m-0 tracking-[1px]">📖 โพยสภาลับ (Rules)</h2>
          <button className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-[#888] w-[36px] h-[36px] rounded-full text-[16px] flex items-center justify-center cursor-pointer transition-all duration-200 p-0 m-0 hover:bg-[rgba(239,68,68,0.2)] hover:text-[#fca5a5] hover:border-[rgba(239,68,68,0.4)] hover:rotate-90" onClick={onClose}>✖</button>
        </div>

        {/* Content */}
        <div className="p-[24px] overflow-y-auto text-[#e2e0e8] text-[15px] leading-[1.6]">
          
          <div className="mb-[24px] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-[16px] p-[16px]">
            <h3 className="text-[#ffffff] text-[16px] font-semibold mt-0 mb-[12px] border-b border-dashed border-[rgba(255,255,255,0.1)] pb-[8px] flex items-center gap-[8px]">🎯 เป้าหมายของเกม (Objective)</h3>
            <p className="m-0">
              ผู้เล่นทุกคนจะเริ่มต้นด้วย <b>2 เหรียญ (Coins)</b> และ <b>2 อิทธิพล (ไพ่คว่ำหน้า)</b><br/>
              เป้าหมายของคุณคือการ <b>อยู่รอดเป็นคนสุดท้าย</b> โดยการใช้ Action หลอกลวง ลอบสังหาร หรือรัฐประหาร เพื่อทำลายอิทธิพล (บังคับเปิดไพ่) ของผู้เล่นคนอื่นให้หมด
            </p>
          </div>

          <div className="mb-[24px] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-[16px] p-[16px]">
            <h3 className="text-[#ffffff] text-[16px] font-semibold mt-0 mb-[12px] border-b border-dashed border-[rgba(255,255,255,0.1)] pb-[8px] flex items-center gap-[8px]">⚡ การลงมือ (General Actions)</h3>
            <ul className="pl-[20px] m-0 flex flex-col gap-[8px]">
              <li><b className="text-[#d4af37]">Income (รายได้):</b> รับ 1 เหรียญ <i>(บล็อกไม่ได้)</i></li>
              <li><b className="text-[#93c5fd]">Foreign Aid (เงินช่วยเหลือ):</b> รับ 2 เหรียญ <i>(Duke สามารถบล็อกได้)</i></li>
              <li><b className="text-[#fca5a5]">Coup (รัฐประหาร):</b> จ่าย 7 เหรียญ เลือกทำลายอิทธิพล 1 ใบของผู้เล่นอื่น <i>(บล็อกไม่ได้ / ถ้ามีถึง 10 เหรียญในตาตัวเอง จะถูกบังคับให้ต้อง Coup)</i></li>
            </ul>
          </div>

          <div className="mb-[24px] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-[16px] p-[16px]">
            <h3 className="text-[#ffffff] text-[16px] font-semibold mt-0 mb-[12px] border-b border-dashed border-[rgba(255,255,255,0.1)] pb-[8px] flex items-center gap-[8px]">🎭 พลังตัวละคร (Character Abilities)</h3>
            <p className="text-[13px] text-[#888] mt-0">*คุณสามารถอ้างว่าตัวเองมีไพ่ใบไหนก็ได้เพื่อใช้พลัง (Bluffing)</p>
            
            <div className="grid grid-cols-1 min-[500px]:grid-cols-2 gap-[12px]">
              <div className="bg-[rgba(0,0,0,0.3)] border-l-[4px] border-[#8b5cf6] p-[12px] rounded-[8px]">
                <span className="text-[#c4b5fd] font-bold font-cinzel text-[16px] mb-[4px] block">Duke (ดยุก)</span>
                <span className="text-[13px]"><b>Action:</b> รับ 3 เหรียญ (Tax)<br/><b>Block:</b> บล็อก Foreign Aid ได้</span>
              </div>
              <div className="bg-[rgba(0,0,0,0.3)] border-l-[4px] border-[#ef4444] p-[12px] rounded-[8px]">
                <span className="text-[#fca5a5] font-bold font-cinzel text-[16px] mb-[4px] block">Assassin (มือสังหาร)</span>
                <span className="text-[13px]"><b>Action:</b> จ่าย 3 เหรียญ ลอบสังหารผู้เล่นอื่นให้เสีย 1 อิทธิพล</span>
              </div>
              <div className="bg-[rgba(0,0,0,0.3)] border-l-[4px] border-[#3b82f6] p-[12px] rounded-[8px]">
                <span className="text-[#93c5fd] font-bold font-cinzel text-[16px] mb-[4px] block">Captain (กัปตัน)</span>
                <span className="text-[13px]"><b>Action:</b> ปล้น 2 เหรียญจากผู้เล่น<br/><b>Block:</b> บล็อกการปล้นจาก Captain คนอื่น</span>
              </div>
              <div className="bg-[rgba(0,0,0,0.3)] border-l-[4px] border-[#10b981] p-[12px] rounded-[8px]">
                <span className="text-[#6ee7b7] font-bold font-cinzel text-[16px] mb-[4px] block">Ambassador (ทูต)</span>
                <span className="text-[13px]"><b>Action:</b> จั่วไพ่กองกลาง 2 ใบ มาเลือกสลับกับไพ่ในมือ<br/><b>Block:</b> บล็อกการปล้นจาก Captain ได้</span>
              </div>
              <div className="bg-[rgba(0,0,0,0.3)] border-l-[4px] border-[#ec4899] p-[12px] rounded-[8px]">
                <span className="text-[#f9a8d4] font-bold font-cinzel text-[16px] mb-[4px] block">Contessa (เคาน์เตส)</span>
                <span className="text-[13px]"><b>Block เท่านั้น:</b> บล็อกการลอบสังหารจาก Assassin ได้</span>
              </div>
            </div>
          </div>

          <div className="mb-0 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-[16px] p-[16px]">
            <h3 className="text-[#ffffff] text-[16px] font-semibold mt-0 mb-[12px] border-b border-dashed border-[rgba(255,255,255,0.1)] pb-[8px] flex items-center gap-[8px]">🚨 การจับโกหก (Challenge)</h3>
            <p className="m-0">
              เมื่อผู้เล่นคนใดประกาศใช้พลังตัวละคร หรือประกาศบล็อก ผู้เล่นคนอื่นสามารถขัดจังหวะด้วยการ <b>"Challenge (จับโกหก)"</b> ได้ทันที
            </p>
            <ul className="pl-[20px] m-[8px_0_0_0] text-[#fca5a5]">
              <li><b>ถ้าคนถูกจับโกหก "ไม่มีไพ่ใบนั้นจริง":</b> คนโกหกต้องเสียอิทธิพล 1 ใบ</li>
              <li><b className="text-[#6ee7b7]">แต่ถ้าคนถูกจับโกหก "มีไพ่ใบนั้นจริง":</b> เขาจะโชว์ไพ่ให้ดู (แล้วเอาไปสับกองกลางจั่วใบใหม่) และ <b>คนจับโกหกพลาดจะต้องเสียอิทธิพล 1 ใบแทน!</b></li>
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
}