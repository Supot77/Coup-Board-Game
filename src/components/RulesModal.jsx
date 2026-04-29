export default function RulesModal({ onClose }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: 'var(--navy)', padding: '20px', borderRadius: '15px', maxWidth: '400px', width: '90%', border: '3px solid var(--gold)', position: 'relative', color: 'white' }}>
        
        <button onClick={onClose} style={{ position: 'absolute', top: '-5px', right: '-5px', backgroundColor: 'var(--red)', padding: '8px 12px', borderRadius: '50%', margin: 0 }}>X</button>
        
        <h2 style={{ marginTop: 0, color: 'var(--gold)', textAlign: 'center' }}>📖 กติกาตัวละคร</h2>
        <ul style={{ lineHeight: '1.8', fontSize: '15px', paddingLeft: '20px' }}>
          <li><b style={{color: '#9b59b6'}}>Duke (ดยุก):</b> รับเงินทีละ 3 เหรียญ / สามารถใช้บล็อก Foreign Aid ได้</li>
          <li><b style={{color: '#34495e'}}>Assassin (นักฆ่า):</b> จ่าย 3 เหรียญเพื่อลอบสังหารเป้าหมาย (เป้าหมายเสียไพ่ 1 ใบ)</li>
          <li><b style={{color: '#3498db'}}>Captain (กัปตัน):</b> ขโมยเงิน 2 เหรียญจากเป้าหมาย / บล็อกการถูกขโมยจากคนอื่นได้</li>
          <li><b style={{color: '#2ecc71'}}>Ambassador (ทูต):</b> จั่วไพ่กองกลางมา 2 ใบ เลือกเก็บไว้และคืนกอง 2 ใบ / บล็อกการถูกขโมยได้</li>
          <li><b style={{color: '#e74c3c'}}>Contessa (เคาน์เตส):</b> ไม่มีแอคชั่นหลัก แต่สามารถบล็อกการถูกลอบสังหารจาก Assassin ได้</li>
        </ul>
      </div>
    </div>
  );
}