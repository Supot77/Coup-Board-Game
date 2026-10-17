import { useDialog } from './DialogProvider';
import { useState, useEffect } from 'react';
import { User } from '../types';
import { useSession } from './SessionProvider';

export default function Login({ onLoginSuccess, onShowRules }: { onLoginSuccess: (user: User) => void; onShowRules: () => void }) {
  const { notify } = useDialog();
  const { beginSession, isSessionReady } = useSession();
  const [username, setUsername] = useState<string>("");
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    const savedName = localStorage.getItem('coup_player_name');
    if (savedName) setUsername(savedName);
  }, []);

  const handleLogin = async () => {
    if (!username.trim()) {
      notify("กรุณากรอกชื่อผู้เล่นก่อนเริ่มเล่น");
      return;
    }
    setIsSigningIn(true);
    try {
      const player = await beginSession(username);
      onLoginSuccess(player);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      const message = code === 'auth/operation-not-allowed'
        ? 'Firebase ยังไม่ได้เปิดการเข้าสู่ระบบแบบผู้เล่นชั่วคราว'
        : 'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจการเชื่อมต่อแล้วลองอีกครั้ง';
      notify(message);
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="login-bg fixed top-0 left-0 w-screen h-screen flex items-center justify-center lg:justify-end px-4 lg:px-0 lg:pr-[8%] box-border z-10 bg-[linear-gradient(to_right,rgba(0,0,0,0)_40%,rgba(10,10,10,0.95)_85%),url('/bg-login.jpg')] bg-cover bg-center bg-no-repeat">
      <div className="login-card bg-[rgba(15,15,15,0.4)] backdrop-blur-[20px] backdrop-saturate-[120%] border border-[rgba(241,196,15,0.2)] shadow-[0_24px_48px_rgba(0,0,0,0.6)] w-full max-w-[400px] rounded-[24px] p-[40px] text-center m-0">
        <h1 className="font-semibold text-[32px] mb-[8px] text-gold [text-shadow:2px_2px_4px_rgba(0,0,0,0.8)]">COUP</h1>
        <p className="text-[#cccccc] text-[15px] mt-0 mb-[32px]">กรอกชื่อผู้เล่นเพื่อเริ่มเล่น · หากไม่มีการใช้งาน 30 นาที ต้องเริ่มเข้าสู่ระบบใหม่</p>
        <input 
          type="text" 
          placeholder="ชื่อผู้เล่นของคุณ" 
          value={username} 
          onChange={(e) => setUsername(e.target.value)} 
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleLogin(); } }}
          className="bg-[rgba(0,0,0,0.5)] border border-[rgba(255,255,255,0.1)] mb-[24px] text-gold placeholder:text-[#666666] focus:bg-[rgba(0,0,0,0.8)] focus:border-gold focus:shadow-[0_0_0_4px_rgba(241,196,15,0.15)] outline-none w-full p-2 rounded"
        />
        <button 
          className="bg-[linear-gradient(135deg,#ffbc1f_0%,#ffbc1f_100%)] text-[#000000] w-full text-[18px] tracking-[0.5px] border border-[rgba(241,196,15,0.3)] shadow-[0_4px_15px_rgba(0,0,0,0.5)] m-0 p-2 cursor-pointer hover:not-disabled:bg-[linear-gradient(135deg,#ffffff_0%,#ffffff_0%)] hover:not-disabled:border-[rgba(241,196,15,0.6)] hover:not-disabled:scale-[0.98] hover:not-disabled:shadow-[0_2px_8px_rgba(0,0,0,0.8)] hover:not-disabled:filter-none transition-all duration-200 rounded" 
          disabled={!isSessionReady || isSigningIn}
          onClick={() => { void handleLogin(); }}
        >
          {isSigningIn ? 'กำลังเข้าสู่ระบบ…' : 'เริ่มเล่น'}
        </button>
        <button className="utility-button w-full mt-3" onClick={onShowRules}>วิธีเล่นและกติกา</button>
      </div>
    </div>
  );
}
