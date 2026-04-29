// components/OpponentList.jsx
import React from 'react';

const cardImages = {
  "Duke": "/img/duk.jpg?v=2",
  "Assassin": "/img/ass.jpg?v=2",
  "Captain": "/img/cap.jpg?v=2",
  "Ambassador": "/img/amb.jpg?v=2",
  "Contessa": "/img/cont.jpg?v=2"
};

export default function OpponentList({ players, userToken, roomData }) {
  return (
    <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px' }}>
      <h3 style={{ color: 'var(--gold)', margin: '0 0 15px 0' }}>👥 คู่แข่งของคุณ</h3>
      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
        {players.filter(p => p.id !== userToken).map(p => {
          const isActiveTurn = roomData?.turnOrder?.[roomData?.currentTurnIndex] === p.id;
          return (
            <div key={p.id} style={{ 
              backgroundColor: 'rgba(255,255,255,0.1)', 
              padding: '15px', 
              borderRadius: '12px', 
              textAlign: 'center', 
              flex: '1 1 120px', 
              opacity: p.isDead ? 0.3 : 1, 
              border: isActiveTurn ? '2px solid var(--gold)' : '2px solid transparent',
              boxShadow: isActiveTurn ? '0 0 15px var(--gold)' : 'none',
              transition: 'all 0.3s ease'
            }}>
              <h4 style={{ margin: '0 0 5px 0', fontSize: '16px', color: isActiveTurn ? 'var(--gold)' : 'white' }}>{p.name}</h4>
              <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>💰 {p.coins}</p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginTop: '10px' }}>
                {p.cards?.map((c, i) => (
                  <div key={i} style={{ width: '40px', height: '60px', borderRadius: '5px', border: '1px solid #ccc', backgroundColor: c.isDead ? '#7f8c8d' : 'var(--red)', backgroundImage: c.isDead && cardImages[c.character] ? `url(${cardImages[c.character]})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', filter: c.isDead ? 'grayscale(100%)' : 'none', position: 'relative' }}>
                    {c.isDead && <div style={{ position:'absolute', bottom:0, width:'100%', background:'rgba(0,0,0,0.8)', fontSize:'9px', padding: '2px 0' }}>{c.character}</div>}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
}