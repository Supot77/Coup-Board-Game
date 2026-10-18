import type { PlayerAvatarId } from '../types';
import PlayerAvatar from './PlayerAvatar';

export default function AvatarPicker({ value, onChange }: {
  value: PlayerAvatarId | null;
  onChange: (value: PlayerAvatarId) => void;
}) {
  return (
    <fieldset className="avatar-picker">
      <legend>เลือกตัวละครก่อนเข้าห้อง</legend>
      <div className="avatar-picker-options">
        <button type="button" className={`avatar-choice ${value === 'male' ? 'selected' : ''}`}
          aria-pressed={value === 'male'} onClick={() => onChange('male')}>
          <span className="avatar-choice-symbol"><PlayerAvatar avatarId="male" isReady={false} seatDirection="top" /></span>
          <span>ชาย</span>
        </button>
        <button type="button" className={`avatar-choice ${value === 'female' ? 'selected' : ''}`}
          aria-pressed={value === 'female'} onClick={() => onChange('female')}>
          <span className="avatar-choice-symbol"><PlayerAvatar avatarId="female" isReady={false} seatDirection="top" /></span>
          <span>หญิง</span>
        </button>
      </div>
      {!value && <p className="avatar-picker-hint">ตัวละครจะไม่บอกบทบาทหรือไพ่ในมือของคุณ</p>}
    </fieldset>
  );
}
