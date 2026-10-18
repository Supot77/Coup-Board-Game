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
    if (isSigningIn || !isSessionReady) return;
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
    <main className="login-bg entry-page">
      <header className="entry-masthead"><span className="entry-monogram" aria-hidden="true">C</span><span>THE SECRET COUNCIL</span><span className="entry-edition">เกมแห่งการชิงอำนาจ</span></header>
      <div className="entry-layout">
      <aside className="entry-story" aria-label="เกี่ยวกับเกม">
        <span className="entry-kicker">อำนาจอยู่ในมือคุณ</span>
        <p>ทุกคำพูด<br />เปลี่ยนเกมได้<span>.</span></p>
        <div className="entry-story-foot"><span>บลัฟให้แนบเนียน จับโกหกให้ถูกคน</span><span>ผู้เล่น 2–6 คน</span></div>
      </aside>
      <section className="login-card entry-card" aria-labelledby="entry-title">
        <div className="entry-seal" aria-hidden="true">✦</div>
        <p className="eyebrow">THE SECRET COUNCIL</p>
        <h1 id="entry-title">COUP</h1>
        <p className="entry-subtitle">เริ่มต้นเกมชิงอำนาจ</p>
        <div className="entry-divider" aria-hidden="true"><span>◆</span></div>
        <p className="login-intro">ตั้งชื่อของคุณ แล้วชวนเพื่อนมาร่วมสภาลับ</p>
        <form onSubmit={event => { event.preventDefault(); void handleLogin(); }}>
        <label htmlFor="player-name">ชื่อผู้เล่น</label>
        <input id="player-name" type="text" autoComplete="nickname" placeholder="ชื่อผู้เล่นของคุณ" value={username} aria-describedby="entry-name-help"
          onChange={event => setUsername(event.target.value)} />
        <p id="entry-name-help" className="entry-name-help">ชื่อนี้จะแสดงให้ผู้เล่นคนอื่นเห็นในห้อง</p>
        <button type="submit" className="button-primary login-submit" disabled={!isSessionReady || isSigningIn} aria-live="polite">
          <span>{isSigningIn ? 'กำลังเข้าสู่ระบบ…' : !isSessionReady ? 'กำลังเตรียมเซสชัน…' : 'เริ่มเล่น'}</span><span aria-hidden="true">↗</span>
        </button>
        </form>
        <button type="button" className="button-secondary login-rules" onClick={onShowRules}>วิธีเล่นและกติกา</button>
        <p className="entry-session-note">หากไม่มีการใช้งาน 30 นาที<br />ระบบจะให้เริ่มเข้าสู่ระบบใหม่</p>
      </section>
      </div>
      <footer className="entry-footer"><span>COUP · THE SECRET COUNCIL</span><span>ซ่อนไพ่ อ่านใจ ชิงอำนาจ</span></footer>
    </main>
  );
}
