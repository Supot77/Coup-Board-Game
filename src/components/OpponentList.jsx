import React from 'react';

// ดึงรูปภาพมาใช้เฉลยการ์ดที่ตายแล้วให้สวยงาม
const cardImages = {
  "Duke": "/img/duk.jpg",
  "Assassin": "/img/ass.jpg",
  "Captain": "/img/cap.jpg",
  "Ambassador": "/img/amb.jpg",
  "Contessa": "/img/cont.jpg"
};

export default function OpponentList({ players, userToken, roomData }) {
  return (
    <div className="gb-panel">
      <div className="gb-panel-title">👥 PLAYERS</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {players.map(p => {
          const isActiveTurn = roomData?.turnOrder?.[roomData?.currentTurnIndex] === p.id;
          const isMe = p.id === userToken;
          
          return (
            <div key={p.id} className={`player-ring ${isActiveTurn ? 'active' : ''}`} style={{ opacity: p.isDead ? 0.4 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: isActiveTurn ? '#d4af37' : '#ccc', fontWeight: isActiveTurn ? '600' : '400', fontSize: '15px' }}>
                  {isMe ? '👑 ' : ''}{p.name}
                </span>
                {isActiveTurn && <span style={{ fontSize: '10px', color: '#d4af37', background: 'rgba(212,175,55,0.15)', padding: '2px 6px', borderRadius: '4px' }}>TURN</span>}
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                
                {/* โซนแสดงไพ่คู่แข่ง */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                  {p.cards?.map((c, i) => (
                    <div 
                      key={i} 
                      className={`opponent-card ${c.isDead ? 'dead' : 'alive'}`}
                      style={{ 
                        // แทรกรูปภาพเฉพาะตอนตายเท่านั้น
                        backgroundImage: c.isDead ? `linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.95) 100%), url(${cardImages[c.character] || ''})` : 'none'
                      }}
                    >
                      {/* เฉลยชื่อการ์ดเฉพาะใบที่ตายแล้ว */}
                      {c.isDead && (
                        <span className="dead-card-text">
                          {c.character}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* โซนเงิน */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#d4af37', fontSize: '18px', fontWeight: 'bold' }}>{p.coins}</span>
                  <span className="glowing-coin" style={{ fontSize: '16px' }}>🪙</span>
                </div>
                
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
}