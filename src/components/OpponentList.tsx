import React from 'react';

import { Player, RoomData } from '../types';

// ดึงรูปภาพมาใช้เฉลยการ์ดที่ตายแล้วให้สวยงาม
const cardImages: Record<string, string> = {
  "Duke": "/img/duk.jpg",
  "Assassin": "/img/ass.jpg",
  "Captain": "/img/cap.jpg",
  "Ambassador": "/img/amb.jpg",
  "Contessa": "/img/cont.jpg"
};

interface OpponentListProps {
  players: Player[];
  userToken: string;
  roomData: RoomData;
}

export default function OpponentList({ players, userToken, roomData }: OpponentListProps) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-[20px] p-5 relative box-border">
      <div className="text-[#888] text-xs uppercase tracking-[2px] font-semibold mb-4 flex items-center gap-2">👥 PLAYERS</div>
      <div className="flex flex-col gap-[12px]">
        {players.map(p => {
          const isActiveTurn = roomData?.turnOrder?.[roomData?.currentTurnIndex] === p.id;
          const isMe = p.id === userToken;
          
          return (
            <div key={p.id} className={`rounded-xl p-3 mb-3 transition-medium ${isActiveTurn ? 'bg-[rgba(212,175,55,0.08)] border border-[rgba(212,175,55,0.3)] shadow-[0_0_0_2px_rgba(212,175,55,0.4)]' : 'bg-white/[0.02] border border-white/[0.04]'} ${p.isDead ? 'opacity-40' : 'opacity-100'}`}>
              <div className="flex justify-between mb-[10px]">
                <span className={`text-[15px] ${isActiveTurn ? 'text-dark-gold font-semibold' : 'text-[#ccc] font-normal'}`}>
                  {isMe ? '👑 ' : ''}{p.name}
                </span>
                {isActiveTurn && <span className="text-[10px] text-dark-gold bg-[rgba(212,175,55,0.15)] px-[6px] py-[2px] rounded-[4px]">TURN</span>}
              </div>
              
              <div className="flex justify-between items-center">
                
                {/* โซนแสดงไพ่คู่แข่ง */}
                <div className="flex gap-[8px] items-end">
                  {p.cards?.map((c, i) => (
                    <div 
                      key={i} 
                      className={`w-[42px] h-[60px] rounded-md flex items-end justify-center pb-1 transition-medium overflow-hidden ${c.isDead ? 'bg-[100%_100%] bg-center bg-no-repeat border border-[rgba(239,68,68,0.5)] shadow-none bg-black/80' : 'opponent-card-alive border border-white/20 shadow-[2px_2px_5px_rgba(0,0,0,0.3)]'}`}
                      style={{ 
                        // แทรกรูปภาพเฉพาะตอนตายเท่านั้น
                        backgroundImage: c.isDead ? `linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.95) 100%), url(${cardImages[c.character] || ''})` : 'none'
                      }}
                    >
                      {/* เฉลยชื่อการ์ดเฉพาะใบที่ตายแล้ว */}
                      {c.isDead && (
                        <span className="text-[#fca5a5] text-[8px] font-bold font-cinzel line-through [text-shadow:1px_1px_4px_black,0px_0px_2px_black] whitespace-nowrap text-center w-full scale-95">
                          {c.character}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* โซนเงิน */}
                <div className="flex items-center gap-[6px]">
                  <span className="text-dark-gold text-[18px] font-bold">{p.coins}</span>
                  <span className="animate-coin-glow text-[16px]">🪙</span>
                </div>
                
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
}