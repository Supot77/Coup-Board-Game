import { useState, useEffect } from 'react';
import './Login.css';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState("");

  useEffect(() => {
    const savedName = localStorage.getItem('coup_player_name');
    if (savedName) setUsername(savedName);
  }, []);

  const handleLogin = () => {
    if (!username.trim()) {
      alert("กรุณาใส่ชื่อของคุณก่อนเข้าเล่นครับ!");
      return;
    }

    let token = localStorage.getItem('coup_session_token');
    if (!token) {
      token = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      localStorage.setItem('coup_session_token', token);
    }
    
    localStorage.setItem('coup_player_name', username.trim());
    onLoginSuccess({ token, name: username.trim() });
  };

  return (
    <div className="login-background">
      <div className="view-container glass-effect dark-theme">
        {/* ใช้สีทอง (Gold) ให้เข้ากับบัลลังก์ในภาพ */}
        <h1 style={{ fontWeight: '600', fontSize: '32px', marginBottom: '8px', color: '#f1c40f', textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
          COUP
        </h1>
        
        {/* สีเทาสว่างสำหรับคำอธิบาย */}
        <p style={{ color: '#cccccc', fontSize: '15px', marginTop: 0, marginBottom: '32px' }}>
          กรุณาระบุชื่อเพื่อเข้าสู่โถงอำนาจ
        </p>

        <input 
          type="text" 
          placeholder="ชื่อผู้เล่นของคุณ" 
          value={username}
          onChange={(e) => setUsername(e.target.value)} 
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()} 
        />
        
        <button className="primary" onClick={handleLogin}>
          เข้าร่วมการแย่งชิง
        </button>
      </div>
    </div>
  );
}