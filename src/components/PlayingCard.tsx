import type { CSSProperties } from 'react';

export type CardRole = 'Duke' | 'Assassin' | 'Captain' | 'Ambassador' | 'Contessa';

const roleArtwork: Record<CardRole, string> = {
  Duke: '/img/DUKE.png',
  Assassin: '/img/ASSASSIN.png',
  Captain: '/img/CAPTAIN.png',
  Ambassador: '/img/AMBASSADOR.png',
  Contessa: '/img/CONTESSA.png',
};

const roleAccents: Record<CardRole, string> = {
  Duke: '#3E918A',
  Assassin: '#B6322C',
  Captain: '#527D91',
  Ambassador: '#A687B0',
  Contessa: '#A75D69',
};

interface PlayingCardProps {
  role?: string;
  faceDown?: boolean;
  revealed?: boolean;
  selected?: boolean;
  className?: string;
}

export default function PlayingCard({
  role,
  faceDown = false,
  revealed = false,
  selected = false,
  className = '',
}: PlayingCardProps) {
  const validRole = role && role in roleArtwork ? role as CardRole : undefined;
  const stateClass = [
    'playing-card',
    faceDown || !validRole ? 'playing-card-back' : 'playing-card-front',
    revealed ? 'playing-card-revealed' : '',
    selected ? 'playing-card-selected' : '',
    className,
  ].filter(Boolean).join(' ');

  if (faceDown || !validRole) {
    return (
      <div className={stateClass} role="img" aria-label="ไพ่คว่ำ">
        <svg className="playing-card-emblem" viewBox="0 0 100 140" aria-hidden="true" focusable="false">
          <rect x="10" y="10" width="80" height="120" rx="3" />
          <rect x="16" y="16" width="68" height="108" rx="2" />
          <circle cx="50" cy="70" r="23" />
          <circle cx="50" cy="70" r="16" />
          <path d="M34 70h32M50 54v32M39 59l22 22M61 59 39 81" />
        </svg>
      </div>
    );
  }

  const style = { '--card-accent': roleAccents[validRole] } as CSSProperties;
  return (
    <div className={stateClass} role="img" style={style} aria-label={`${validRole}${revealed ? ' เปิดเผยแล้ว' : ''}`}>
      <img className="playing-card-portrait" src={roleArtwork[validRole]} alt="" loading="lazy" />
      <span className="playing-card-accent" aria-hidden="true" />
      <span className="playing-card-label">
        <span className="playing-card-role">{validRole}</span>
        {revealed && <span className="playing-card-state">เปิดเผยแล้ว</span>}
      </span>
    </div>
  );
}
