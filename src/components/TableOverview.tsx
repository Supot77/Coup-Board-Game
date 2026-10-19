import type { Player, RoomData } from '../types';
import PlayerAvatar from './PlayerAvatar';
import GameIcon from './GameIcon';

export default function TableOverview({ players, room, viewerUid }: { players: Player[]; room: RoomData; viewerUid: string }) {
  const ordered = (room.turnOrder ?? []).map(id => players.find(player => player.id === id)).filter((player): player is Player => !!player);
  const roster = [...ordered, ...players.filter(player => !ordered.some(item => item.id === player.id))];
  const current = room.turnOrder?.[room.currentTurnIndex ?? 0];
  const currentIndex = roster.findIndex(player => player.id === current);
  const next = [...roster.slice(currentIndex + 1), ...roster.slice(0, currentIndex)].find(player => !player.isDead);
  const responding = room.gameState === 'waiting_for_responses' || room.gameState === 'waiting_for_block_responses';
  const excluded = room.gameState === 'waiting_for_block_responses' ? room.pendingAction?.blockerId : room.pendingAction?.sourceId;
  return <section className="table-overview" aria-label="ภาพรวมโต๊ะและลำดับเล่น">
    <div className="table-overview-heading"><span><GameIcon kind="cards" />ลำดับเล่น</span>
      <small>{responding ? `รอตอบ ${roster.filter(player => !player.isDead && player.id !== excluded && !room.passVotes?.includes(player.id)).length} คน`
        : room.gameState === 'game_over' ? 'จบรอบแล้ว'
        : room.gameState === 'waiting_for_discard' ? `รอ ${players.find(player => player.id === room.discardTarget)?.name ?? 'ผู้เล่น'} เปิดเผยไพ่`
        : room.gameState === 'waiting_for_exchange' ? 'กำลังเลือกไพ่จาก Exchange'
        : next ? `ตาถัดไป · ${next.name}` : 'รอผู้เล่น'}</small></div>
    <ol>{roster.map(player => {
      const active = current === player.id && !player.isDead && room.gameState !== 'game_over';
      const target = room.pendingAction?.targetId === player.id;
      const needsResponse = responding && !player.isDead && player.id !== excluded;
      return <li key={player.id} data-current={active} data-target={target} data-eliminated={!!player.isDead} data-player-id={player.id}>
        <span className="overview-avatar" aria-hidden="true"><PlayerAvatar avatarId={player.avatarId} isReady={false} seatDirection="top" /></span>
        <div className="overview-player"><b title={player.name}>{player.name}{player.id === viewerUid ? ' · คุณ' : ''}</b>
          <span>🪙 {player.coins} <span aria-hidden="true">·</span> อิทธิพล {player.influenceCount ?? (player.isDead ? 0 : 2)}/2</span>
          <small>{player.isDead ? 'ตกรอบ' : <>{target ? 'เป้าหมาย · ' : ''}{needsResponse ? room.passVotes?.includes(player.id) ? 'ตอบแล้ว' : 'รอตอบ' : active ? 'กำลังเล่น' : 'รอถึงตา'}</>}</small>
        </div>
      </li>;
    })}</ol>
  </section>;
}
