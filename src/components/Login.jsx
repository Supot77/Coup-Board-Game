import { useState, useEffect } from 'react';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState("");

  useEffect(() => {
    const savedName = localStorage.getItem('coup_player_name');
    if (savedName) setUsername(savedName);
  }, []);

  const handleLogin = () => {
    console.log("👉 เช็คการกดปุ่ม! ชื่อที่พิมพ์คือ:", username);

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
    <div className="view-container">
      <h1>เข้าสู่ระบบ Coup</h1>
      <input 
        type="text" 
        placeholder="ใส่ชื่อของคุณ" 
        value={username}
        onChange={(e) => setUsername(e.target.value)} 
        onKeyDown={(e) => e.key === 'Enter' && handleLogin()} 
      />
      <br />
      <button className="primary" onClick={handleLogin}>เข้าสู่ล็อบบี้</button>
    </div>
  );
}