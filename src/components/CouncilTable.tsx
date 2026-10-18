import { useEffect, useMemo, useRef, useState } from 'react';
import type { Player } from '../types';
import PlayerAvatar, { type SeatDirection } from './PlayerAvatar';

const seatLayout: { direction: SeatDirection; className: string }[] = [
  { direction: 'top', className: 'seat-top' },
  { direction: 'upper-right', className: 'seat-upper-right' },
  { direction: 'lower-right', className: 'seat-lower-right' },
  { direction: 'bottom', className: 'seat-bottom' },
  { direction: 'lower-left', className: 'seat-lower-left' },
  { direction: 'upper-left', className: 'seat-upper-left' },
];

function compareIds(left: Player, right: Player) {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

export default function CouncilTable({ players, viewerUid, ownerUid, isProcessing, onReadyChange, onKick }: {
  players: Player[];
  viewerUid: string;
  ownerUid: string;
  isProcessing: boolean;
  onReadyChange: (ready: boolean) => void;
  onKick: (playerId: string, playerName: string) => void;
}) {
  const sortedPlayers = useMemo(() => [...players].sort(compareIds), [players]);
  const previousIds = useRef<Set<string> | null>(null);
  const previousAllReady = useRef<boolean | null>(null);
  const [newPlayerId, setNewPlayerId] = useState<string | null>(null);
  const [readyFlash, setReadyFlash] = useState(false);
  const allReady = players.length > 0 && players.every(player => player.isReady === true);

  useEffect(() => {
    const currentIds = new Set(sortedPlayers.map(player => player.id));
    const previous = previousIds.current;
    if (!previous || previous.size === 0) {
      previousIds.current = currentIds;
      if (currentIds.size === 1) {
        const initialOwnerId = currentIds.values().next().value as string;
        setNewPlayerId(initialOwnerId);
        const timeout = window.setTimeout(() => setNewPlayerId(null), 240);
        return () => window.clearTimeout(timeout);
      }
      return;
    }
    const entrant = sortedPlayers.find(player => !previous.has(player.id));
    if (entrant) {
      setNewPlayerId(entrant.id);
      const timeout = window.setTimeout(() => setNewPlayerId(null), 240);
      previousIds.current = currentIds;
      return () => window.clearTimeout(timeout);
    }
    previousIds.current = currentIds;
  }, [sortedPlayers]);

  useEffect(() => {
    if (players.length === 0) return;
    if (previousAllReady.current === null) {
      previousAllReady.current = allReady;
      return;
    }
    if (previousAllReady.current === false && allReady) {
      setReadyFlash(true);
      const timeout = window.setTimeout(() => setReadyFlash(false), 420);
      previousAllReady.current = allReady;
      return () => window.clearTimeout(timeout);
    }
    previousAllReady.current = allReady;
  }, [allReady, players.length]);

  const viewer = players.find(player => player.id === viewerUid);
  const readyCount = players.filter(player => player.isReady === true).length;

  return (
    <section className="council-lobby" aria-label="โต๊ะสภา">
      <div className={`council-stage council-stage-long ${readyFlash ? 'all-ready-flash' : ''}`}>
        <div className="council-seat-layer">
          {[0, 1].map(row => <div className="council-seat-row" key={row}>
          <div className="council-tabletop" aria-hidden="true"><img src="/assets/secret-council/council-long-table.png" alt="" /></div>
          {seatLayout.slice(row * 3, row * 3 + 3).map((seat, offset) => {
            const index = row * 3 + offset;
            const player = sortedPlayers[index];
            if (!player) {
              return <div className={`council-seat ${seat.className} council-seat-empty`} key={seat.direction} data-seat={seat.direction}>
                <span className="seat-person seat-empty-person" aria-hidden="true"><span className="seat-chair"><svg viewBox="0 0 64 64"><path d="M16 42V21a16 16 0 0 1 32 0v21M12 42h40v8H12zM18 50v7m28-7v7" /></svg></span></span>
                <span className="seat-empty-label">ที่นั่งว่าง</span>
              </div>;
            }
            const isViewer = player.id === viewerUid;
            const isOwner = player.id === ownerUid;
            const isReady = player.isReady === true;
            return <article className={`council-seat ${seat.className} ${newPlayerId === player.id ? 'seat-entering' : ''}`} key={player.id}
              data-seat={seat.direction} data-player-id={player.id}>
              <div className="seat-chair seat-chair-occupied" aria-hidden="true" />
              <div className="seat-person">
                <PlayerAvatar avatarId={player.avatarId} isReady={isReady} seatDirection={seat.direction} />
              </div>
              <div className="seat-details">
                <span className="seat-player-name" title={player.name}>{player.name}</span>
                <span className="seat-markers">
                  {isViewer && <span className="seat-you">คุณ</span>}
                  {isOwner && <span className="seat-owner">เจ้าของห้อง</span>}
                </span>
                <span className={`seat-readiness ${isReady ? 'ready' : 'not-ready'}`}>
                  <span aria-hidden="true">{isReady ? '✓' : '○'}</span>{isReady ? 'พร้อมเล่น' : 'ยังไม่พร้อม'}
                </span>
              </div>
              {ownerUid === viewerUid && player.id !== viewerUid && <button type="button" className="seat-kick-button"
                disabled={isProcessing} onClick={() => onKick(player.id, player.name)} aria-label={`นำ ${player.name} ออกจากห้อง`}>นำออก</button>}
            </article>;
          })}</div>)}
        </div>
      </div>

      <div className="council-roster-mobile" aria-label="รายชื่อผู้เล่นและความพร้อม">
        <h3>ผู้เล่น <span>{players.length}/6</span> · พร้อม {readyCount}/{players.length}</h3>
        <ol>{seatLayout.map((seat, index) => {
          const player = sortedPlayers[index];
          if (!player) return <li key={seat.direction} className="roster-mobile-empty"><span>ที่นั่งว่าง</span><span>—</span></li>;
          return <li key={player.id}>
            <span className="roster-mobile-name">{player.name}{player.id === viewerUid && <small>คุณ</small>}{player.id === ownerUid && <small>เจ้าของห้อง</small>}</span>
            <span className={`seat-readiness ${player.isReady === true ? 'ready' : 'not-ready'}`}>
              {player.isReady === true ? '✓ พร้อมเล่น' : '○ ยังไม่พร้อม'}
            </span>
            {ownerUid === viewerUid && player.id !== viewerUid && <button type="button" className="seat-kick-button"
              disabled={isProcessing} onClick={() => onKick(player.id, player.name)}>นำออก</button>}
          </li>;
        })}</ol>
      </div>

      <div className="council-ready-control">
        <p>{readyCount} จาก {players.length} คนพร้อมแล้ว</p>
        {viewer && <button type="button" className={viewer.isReady === true ? 'button-secondary' : 'button-primary'}
          disabled={isProcessing} onClick={() => onReadyChange(viewer.isReady !== true)}>
          {viewer.isReady === true ? 'ยกเลิกความพร้อม' : 'พร้อมเล่น'}
        </button>}
      </div>
    </section>
  );
}
