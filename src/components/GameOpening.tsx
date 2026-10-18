import { useEffect, useId, useRef, useState } from 'react';
import PlayingCard, { type CardRole } from './PlayingCard';

const portraits: Record<CardRole, string> = {
  Duke: 'DUKE', Assassin: 'ASSASSIN', Captain: 'CAPTAIN', Ambassador: 'AMBASSADOR', Contessa: 'CONTESSA',
};

export default function GameOpening({ roles, onFinish }: { roles: string[] | null; onFinish: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const noiseId = useId();
  const [phase, setPhase] = useState<'fog' | 'cards' | 'motto' | 'exit'>('fog');
  const [artReady, setArtReady] = useState(false);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update);
    return () => { element.close(); media.removeEventListener('change', update); };
  }, []);

  useEffect(() => {
    if (!roles) return;
    let active = true;
    void Promise.all(roles.map(role => new Promise<void>(resolve => {
      const image = new Image();
      image.onload = image.onerror = () => resolve();
      image.src = `/img/${portraits[role as CardRole]}.png`;
    }))).then(() => { if (active) setArtReady(true); });
    return () => { active = false; };
  }, [roles]);

  useEffect(() => {
    if (phase === 'fog' && (!roles || !artReady)) return;
    const duration = phase === 'fog' ? reduced ? 150 : 900
      : phase === 'cards' ? 2600 : phase === 'motto' ? 1400 : reduced ? 0 : 450;
    const timer = window.setTimeout(() => {
      if (phase === 'exit') onFinish();
      else setPhase(phase === 'fog' ? 'cards' : phase === 'cards' ? 'motto' : 'exit');
    }, duration);
    return () => window.clearTimeout(timer);
  }, [phase, roles, artReady, reduced, onFinish]);

  return <dialog ref={dialog} className="game-opening" data-phase={phase} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onFinish(); }}>
    <div className="opening-visuals" aria-hidden="true">
    <div className="opening-vignette" aria-hidden="true" />
    <div className="opening-fog" aria-hidden="true">
      <svg viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid slice" focusable="false">
        <defs><filter id={noiseId} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency=".008 .016" numOctaves="3" seed="12" />
          <feColorMatrix type="matrix" values="0 0 0 0 .48  0 0 0 0 .54  0 0 0 0 .56  1 0 0 0 -.25" />
          <feGaussianBlur stdDeviation="3" />
        </filter></defs>
        <rect width="100%" height="100%" filter={`url(#${noiseId})`} />
      </svg>
      <div className="opening-fog-bank opening-fog-left" /><div className="opening-fog-bank opening-fog-right" />
    </div>
    </div>
    <div className="opening-content">
      <section className="opening-reveal" aria-hidden={phase !== 'cards'}>
        <p className="opening-eyebrow">THE SECRET COUNCIL</p>
        <h1 id={titleId}>บทบาทที่คุณได้รับคือ</h1>
        <p className="opening-private-note">ไพ่ของคุณ · เห็นได้เฉพาะคุณ</p>
        <div className="opening-cards">{roles?.map((role, index) => <PlayingCard key={index} role={role} className="opening-card" />)}</div>
      </section>
      <section className="opening-motto" aria-hidden={phase !== 'motto'}>
        <span className="opening-seal" aria-hidden="true">◆</span>
        <h2>ขอให้อำนาจเป็นของคุณ</h2>
        <p>สภาลับเริ่มต้นแล้ว</p>
      </section>
      <p className="opening-status" role="status">{phase === 'fog' ? 'ม่านหมอกกำลังเปิดสู่สภาลับ…' : phase === 'cards' ? 'บทบาทที่คุณได้รับคือ' : phase === 'motto' ? 'ขอให้อำนาจเป็นของคุณ' : 'เข้าสู่กระดาน'}</p>
    </div>
    <button type="button" className="opening-skip" onClick={onFinish} autoFocus>ข้ามฉากเปิด</button>
  </dialog>;
}
