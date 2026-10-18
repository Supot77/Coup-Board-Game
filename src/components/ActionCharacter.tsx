import { useEffect, useState, type CSSProperties } from 'react';
import PlayingCard from './PlayingCard';

const roles = ['Duke', 'Assassin', 'Captain', 'Ambassador', 'Contessa'];

/** Presentation of a public claim only. Never reads a player's cards. */
export default function ActionCharacter({ role, animate, blocking }: {
  role: string; animate: boolean; blocking: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const validRole = roles.includes(role);
  const atlas = validRole ? `/assets/secret-council/action-${role.toLowerCase()}-v1.webp` : '';
  useEffect(() => {
    if (!atlas) return;
    let active = true;
    const image = new Image();
    image.onload = () => { if (active) setLoaded(true); };
    image.src = atlas;
    return () => { active = false; };
  }, [atlas]);
  if (!validRole) return null;
  const style = { backgroundImage: `url('${atlas}')` } as CSSProperties;
  return <figure className="action-character" data-role={role} data-animated={animate && loaded}>
    <div className="action-character-stage" aria-hidden="true">
      {loaded ? <div className={`action-character-sprite${animate ? ' action-character-playing' : ''}`} style={style} />
        : <PlayingCard role={role} className="action-character-fallback" />}
    </div>
    <figcaption><strong>{role}</strong><span>{blocking ? 'บทบาทที่อ้างเพื่อบล็อก' : 'บทบาทที่อ้างเพื่อใช้แอคชั่น'}</span></figcaption>
  </figure>;
}
