// components/VictoryScreen.jsx

export default function VictoryScreen({ winnerName, isAdmin, onAdminReset }) {
  return (
    <div className="game-board-full" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', minHeight: '70vh' }}>
      <h1 style={{ color: 'var(--gold)', fontSize: '60px', margin: '0 0 15px 0' }}>🏆 ยินดีด้วย! 🏆</h1>
      <h2 style={{ fontSize: '32px', color: 'white', marginBottom: '40px' }}>
        <span style={{ color: 'var(--gold)', fontWeight: 'bold' }}>{winnerName}</span> คือผู้รอดชีวิตคนสุดท้าย!
      </h2>
      
      <div style={{ backgroundColor: 'rgba(0,0,0,0.4)', padding: '30px', borderRadius: '15px' }}>
        {isAdmin ? (
          <>
            <p style={{ color: 'white', marginBottom: '20px' }}>คุณในฐานะหัวหน้าห้อง สามารถพาทุกคนกลับล็อบบี้ได้</p>
            <button className="primary" style={{ fontSize: '18px', padding: '15px 30px' }} onClick={onAdminReset}>
              กลับไปที่ล็อบบี้เพื่อเตรียมเริ่มเกมใหม่
            </button>
          </>
        ) : (
          <p style={{ color: 'var(--gold)', fontSize: '20px', fontWeight: 'bold', margin: 0 }}>
            ⏳ กำลังรอหัวหน้าห้องพากลับล็อบบี้...
          </p>
        )}
      </div>
    </div>
  );
}