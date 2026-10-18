import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import Login from './components/Login';
import Lobby from './components/Lobby';
import { User } from './types';
import { useSession } from './components/SessionProvider';
import LoadingScreen from './components/LoadingScreen';
import GameOpening from './components/GameOpening';
import { useStartupLoading } from './core/useStartupLoading';

const RulesModal = lazy(() => import('./components/RulesModal'));
const GameBoard = lazy(() => import('./components/GameBoard'));

function App() {
  const { authUser, isSessionReady, isSessionActive, logout } = useSession();
  const startup = useStartupLoading(isSessionReady);
  const [currentView, setCurrentView] = useState<string>('login');
  const [user, setUser] = useState<User>({ token: '', name: '' });
  const [playingRoomCode, setPlayingRoomCode] = useState<string | null>(null);
  const [showRules, setShowRules] = useState<boolean>(false);
  const [opening, setOpening] = useState<{ roomCode: string; roles: string[] | null } | null>(null);
  const finishOpening = useCallback(() => setOpening(null), []);
  const receiveOpeningCards = useCallback((roles: string[] | null) => {
    if (!roles) setOpening(null);
    else setOpening(current => current && !current.roles ? { ...current, roles } : current);
  }, []);

  // Restore only an unexpired local guest session; an idle guest must press login again.
  useEffect(() => {
    if (!isSessionReady) return;
    const name = localStorage.getItem('coup_player_name');
    if (authUser && isSessionActive && name) {
      setUser({ token: authUser.uid, name });
      setCurrentView('lobby');
    } else if (!isSessionActive) {
      setOpening(null);
      setCurrentView('login');
    }
  }, [authUser, isSessionReady, isSessionActive]);

  // ฟังก์ชันสลับไปหน้า Lobby
  const handleLoginSuccess = useCallback((userData: User) => {
    console.log("✅ App.tsx ได้รับข้อมูลแล้ว! กำลังสลับไปหน้า Lobby...");
    setUser(userData);
    setCurrentView('lobby');
  }, []);

  // ฟังก์ชันออกจากระบบ
  const handleLogout = useCallback(async () => {
    await logout();
    setUser({ token: '', name: '' });
    setCurrentView('login');
  }, [logout]);

  // ฟังก์ชันสลับไปหน้ากระดานเกม
  const handleGameStart = useCallback((roomCode: string, newGame = false) => {
    if (newGame) setOpening({ roomCode, roles: null });
    setPlayingRoomCode(roomCode);
    setCurrentView('game');
  }, []);
  const handleLeaveGame = useCallback(() => { setOpening(null); setCurrentView('lobby'); }, []);

  if (startup.visible) return <LoadingScreen progress={startup.progress} detail={startup.detail} />;

  return (
    <>
      {opening && <GameOpening roles={opening.roles} onFinish={finishOpening} />}
      {/* หน้าต่างกติกา */}
      {showRules && <Suspense fallback={<LoadingScreen message="กำลังโหลดกติกา" />}><RulesModal onClose={() => setShowRules(false)} /></Suspense>}

      {/* ควบคุมการแสดงผลหน้าจอหลัก */}
      {currentView === 'login' && <Login onLoginSuccess={handleLoginSuccess} onShowRules={() => setShowRules(true)} />}
      {currentView === 'lobby' && <Lobby user={user} onLogout={handleLogout} onGameStart={handleGameStart} onShowRules={() => setShowRules(true)} />}
      
      {/* ส่ง onShowRules เข้าไปใน GameBoard ด้วย */}
      {currentView === 'game' && playingRoomCode && (
        <Suspense fallback={<LoadingScreen message="กำลังโหลดกระดานเกม" />}>
        <GameBoard 
          roomCode={playingRoomCode} 
          user={user} 
          onLeaveGame={handleLeaveGame}
          onShowRules={() => setShowRules(true)} 
          opening={opening?.roomCode === playingRoomCode} onOpeningCards={receiveOpeningCards}
        />
        </Suspense>
      )}
    </>
  );
}

export default App;
