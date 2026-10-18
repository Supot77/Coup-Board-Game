import type { Player, RoomData } from '../types';
import PlayingCard from './PlayingCard';
import PlayerAvatar from './PlayerAvatar';

export default function OpponentList({ players, userToken, roomData }: {
  players: Player[]; userToken: string; roomData: RoomData;
}) {
  return <section className="players-panel game-panel" aria-label="ผู้เล่น">
    <h2 className="panel-heading">ผู้เล่น <span>{players.length}</span></h2>
    <div className="opponents-grid">
      {players.map(player => {
        const isActive = roomData?.turnOrder?.[roomData?.currentTurnIndex] === player.id;
        const cards = player.cards ?? (() => {
          const revealed = player.revealedCards ?? [];
          const hiddenCount = player.influenceCount ?? (player.isDead ? 0 : 2);
          const slotCount = Math.max(2, revealed.reduce((max, card) => Math.max(max, card.slot + 1), 0));
          const slots = Array.from({ length: slotCount }, () => ({ character: '', isDead: false }));
          revealed.forEach(card => { slots[card.slot] = { character: card.character, isDead: true }; });
          let remainingHidden = hiddenCount;
          slots.forEach((slot, index) => {
            if (!slot.isDead && remainingHidden > 0) {
              slots[index] = { character: '', isDead: false };
              remainingHidden -= 1;
            }
          });
          return slots;
        })();
        return <article key={player.id} className={`opponent ${isActive ? 'opponent-active' : ''} ${player.isDead ? 'opponent-eliminated' : ''}`}>
          <div className="opponent-heading">
            <span className="opponent-avatar"><PlayerAvatar avatarId={player.avatarId} isReady={false} seatDirection="top" /></span>
            <span className="player-name">{player.name}{player.id === userToken ? ' (คุณ)' : ''}</span>
            {isActive && !player.isDead && <span className="turn-badge">ถึงตา</span>}
            {player.isDead && <span className="eliminated-badge">ตกรอบ</span>}
          </div>
          <div className="opponent-details">
            <div className="opponent-cards">
              {cards.map((card, index) => <PlayingCard key={index} role={card.character}
                faceDown={!card.isDead} revealed={card.isDead}
                className={`opponent-card ${card.isDead ? 'revealed-card' : 'opponent-card-alive'}`} />)}
            </div>
            <span className="player-coins" aria-label={`${player.coins} เหรียญ`}>🪙 {player.coins}</span>
          </div>
        </article>;
      })}
    </div>
  </section>;
}
