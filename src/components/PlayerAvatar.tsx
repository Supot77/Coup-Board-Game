import { useEffect, useRef, useState } from 'react';
import type { PlayerAvatarId } from '../types';

export type SeatDirection = 'top' | 'upper-right' | 'lower-right' | 'bottom' | 'lower-left' | 'upper-left';

// Register transparent cutouts to a shared bottom/centre anchor in CSS.
const registration = {
  male: [[-.5, 1], [-1, -4], [-1.5, -5], [-1, -4], [-.5, -2], [-1.5, -1], [-1.5, 0], [-3, -2], [-3, 0], [-3.5, 1], [-4, 1], [-4, 2]],
  female: [[-1, -2], [-1, -4], [-1, -4], [-1, -4], [-1, -4], [-1, -3], [-1, -3], [-1, -1], [-1, 3], [-.5, 4], [-1, 3], [-1, 3]],
};

export default function PlayerAvatar({ avatarId, isReady, seatDirection }: {
  avatarId?: PlayerAvatarId;
  isReady: boolean;
  seatDirection: SeatDirection;
}) {
  const [frame, setFrame] = useState(isReady ? 11 : 0);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const currentFrame = useRef(frame);
  const previous = useRef({ avatarId, isReady });
  const source = avatarId ? `/assets/secret-council/avatar-${avatarId}.png` : '';

  useEffect(() => {
    const target = isReady ? 11 : 0;
    const old = previous.current;
    previous.current = { avatarId, isReady };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let animation = 0;
    const paint = (next: number) => {
      currentFrame.current = next;
      setFrame(next);
    };
    const snap = () => {
      if (!reduced.matches) return;
      window.cancelAnimationFrame(animation);
      paint(target);
    };
    if (old.avatarId !== avatarId || old.isReady === isReady || reduced.matches) {
      paint(target);
      return;
    }
    const from = currentFrame.current;
    const direction = Math.sign(target - from);
    const distance = Math.abs(target - from);
    const start = performance.now();
    const tick = (now: number) => {
      // A RAF timestamp can precede performance.now() earlier in that frame.
      const step = Math.min(distance, Math.max(0, Math.floor((now - start) * 24 / 1000)));
      paint(from + direction * step);
      if (step < distance) animation = window.requestAnimationFrame(tick);
    };
    animation = window.requestAnimationFrame(tick);
    reduced.addEventListener('change', snap);
    return () => {
      window.cancelAnimationFrame(animation);
      reduced.removeEventListener('change', snap);
    };
  }, [avatarId, isReady]);

  if ((avatarId !== 'male' && avatarId !== 'female') || failedSource === source) {
    return <svg className="player-avatar player-avatar-silhouette" viewBox="0 0 180 220" aria-hidden="true" focusable="false"
      data-avatar={avatarId ?? 'legacy'} data-ready={isReady} data-seat={seatDirection}>
      <g data-part="silhouette"><circle cx="90" cy="54" r="31" /><path d="M36 220v-46c0-34 22-55 54-55s54 21 54 55v46z" /></g>
    </svg>;
  }

  const [x, y] = registration[avatarId][frame];
  return <span className={`player-avatar player-avatar-sprite ${isReady ? 'is-ready' : ''}`} aria-hidden="true"
    data-avatar={avatarId} data-ready={isReady} data-frame={frame} data-seat={seatDirection}>
    <span className="avatar-frame-registration" style={{ transform: `translate(${x / 362 * 100}%, ${y / 362 * 100}%)` }}>
      <img className="avatar-sprite-sheet" src={source} alt="" draggable={false}
        onError={() => setFailedSource(source)}
        style={{ transform: `translate(${-(frame % 4) * 25}%, ${-Math.floor(frame / 4) * 100 / 3}%)` }} />
    </span>
  </span>;
}
