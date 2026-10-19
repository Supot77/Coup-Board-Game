import { useEffect, useRef, useState } from 'react';
import type { PublicGameEvent } from '../core/gameEvents';
import { playGameSound, unlockGameAudio } from '../core/gameAudio';
import PlayingCard from './PlayingCard';

export default function GameFeedback({ events, roundId, live, myTurn }: { events: PublicGameEvent[]; roundId?: string; live: boolean; myTurn: boolean }) {
  const [sound, setSound] = useState(() => localStorage.getItem('coup_sound_enabled') === 'true');
  const [volume, setVolume] = useState(() => {
    const saved = Number(localStorage.getItem('coup_sound_volume') ?? '.35');
    return Number.isFinite(saved) ? Math.max(0, Math.min(1, saved)) : .35;
  });
  const [feedback, setFeedback] = useState<PublicGameEvent | null>(null);
  const seen = useRef<{ round?: string; sequence: number; ready: boolean }>({ sequence: 0, ready: false });
  const previousTurn = useRef(myTurn);
  useEffect(() => {
    localStorage.setItem('coup_sound_enabled', String(sound));
    localStorage.setItem('coup_sound_volume', String(volume));
    if (!sound) return;
    const unlock = () => { void unlockGameAudio(); };
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
    return () => { document.removeEventListener('pointerdown', unlock); document.removeEventListener('keydown', unlock); };
  }, [sound, volume]);
  useEffect(() => {
    const latest = events[events.length - 1];
    if (!live || seen.current.round !== roundId) {
      seen.current = { round: roundId, sequence: latest?.sequence ?? 0, ready: false };
      setFeedback(null);
      return;
    }
    if (!latest) return;
    if (!seen.current.ready) {
      seen.current = { round: roundId, sequence: latest.sequence, ready: true };
      return;
    }
    const fresh = events.filter(event => event.sequence > seen.current.sequence);
    seen.current.sequence = latest.sequence;
    const meaningful = fresh.filter(event => event.coinChanges.length || event.influenceChanges.length || event.kind === 'challenge');
    const result = meaningful[meaningful.length - 1];
    if (!result) return;
    setFeedback(result);
    if (sound) playGameSound(result.kind === 'challenge' ? 'challenge' : result.influenceChanges.length ? 'card' : 'coin', volume);
  }, [events, roundId, live, sound, volume]);
  useEffect(() => {
    if (myTurn && !previousTurn.current && sound && live) playGameSound('turn', volume);
    previousTurn.current = myTurn;
  }, [myTurn, sound, volume, live]);
  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [feedback]);
  const loser = feedback?.coinChanges.find(change => change.after < change.before);
  const gainer = feedback?.coinChanges.find(change => change.after > change.before);
  return <>
    <details className="game-sound-settings">
      <summary aria-label="ตั้งค่าเสียง">♪ <span>{sound ? 'เสียงเปิด' : 'เสียงปิด'}</span></summary>
      <div className="sound-settings-panel">
        <button type="button" className="utility-button" aria-pressed={sound} onClick={() => { if (!sound) void unlockGameAudio(); setSound(!sound); }}>{sound ? 'ปิดเสียงเกม' : 'เปิดเสียงเกม'}</button>
        <label>ระดับเสียง <output>{Math.round(volume * 100)}%</output><input aria-label="ระดับเสียงเกม" type="range" min="0" max="1" step=".05" value={volume} onChange={event => setVolume(Number(event.target.value))} /></label>
        <small>เสียงเหรียญ ไพ่ และแจ้งถึงตาคุณ</small>
      </div>
    </details>
    {feedback && <aside key={feedback.id ?? feedback.sequence} className="game-feedback" role="status" aria-live="polite">
      {feedback.kind === 'challenge' && <strong>{feedback.challengeSucceeded ? 'จับโกหกสำเร็จ' : 'อีกฝ่ายพิสูจน์บทบาทได้'}</strong>}
      {loser && gainer && <div className="feedback-transfer"><span>{loser.playerName}</span><i aria-hidden="true">🪙 →</i><span>{gainer.playerName}</span></div>}
      {feedback.coinChanges.map(change => <p className="feedback-coin" key={change.playerId}><span>{change.playerName}</span><b>{change.after > change.before ? '+' : ''}{change.after - change.before} เหรียญ</b></p>)}
      {feedback.influenceChanges.map(change => <div className="feedback-influence" key={change.playerId}><span>{change.playerName} เสียอิทธิพล {change.before - change.after} ใบ</span>
        {change.revealed.map((role, index) => <PlayingCard key={index} role={role} revealed className="feedback-reveal-card" />)}</div>)}
      {!feedback.coinChanges.length && !feedback.influenceChanges.length && <p>{feedback.outcome}</p>}
    </aside>}
  </>;
}
