import { useState, useEffect } from 'react';
import Login from './components/Login';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';
import RulesModal from './components/RulesModal';

function App() {
  const [currentView, setCurrentView] = useState('login');
  const [user, setUser] = useState({ token: '', name: '' });
  const [playingRoomCode, setPlayingRoomCode] = useState(null);
  const [showRules, setShowRules] = useState(false);

  // เช็คว่าเคยล็อกอินค้างไว้ไหม
  useEffect(() => {
    const token = localStorage.getItem('coup_session_token');
    const name = localStorage.getItem('coup_player_name');
    if (token && name) {
      setUser({ token, name });
      setCurrentView('lobby');
    }
  }, []);

  // ฟังก์ชันสลับไปหน้า Lobby
  const handleLoginSuccess = (userData) => {
    console.log("✅ App.jsx ได้รับข้อมูลแล้ว! กำลังสลับไปหน้า Lobby...");
    setUser(userData);
    setCurrentView('lobby');
  };

  // ฟังก์ชันออกจากระบบ
  const handleLogout = () => {
    localStorage.removeItem('coup_session_token');
    localStorage.removeItem('coup_player_name');
    setCurrentView('login');
  };

  // ฟังก์ชันสลับไปหน้ากระดานเกม
  const handleGameStart = (roomCode) => {
    setPlayingRoomCode(roomCode);
    setCurrentView('game');
  };

  return (
    <>
      {/* หน้าต่างกติกา */}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      {/* ควบคุมการแสดงผลหน้าจอหลัก */}
      {currentView === 'login' && <Login onLoginSuccess={handleLoginSuccess} />}
      {currentView === 'lobby' && <Lobby user={user} onLogout={handleLogout} onGameStart={handleGameStart} />}
      
      {/* ส่ง onShowRules เข้าไปใน GameBoard ด้วย */}
      {currentView === 'game' && (
        <GameBoard 
          roomCode={playingRoomCode} 
          user={user} 
          onLeaveGame={() => setCurrentView('lobby')} 
          onShowRules={() => setShowRules(true)} 
        />
      )}
    </>
  );
}

export default App;