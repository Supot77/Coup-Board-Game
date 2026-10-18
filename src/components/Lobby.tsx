import { useDialog } from './DialogProvider';
import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../core/firebase';
import type { Player, PlayerAvatarId, User } from '../types';
import { createRoom, getCallableMessage, joinRoom, kickPlayer, leaveRoom, setPlayerReady, setResponseTimeout, startGame } from '../core/roomCommands';
import { watchLobbyMaintenance } from '../core/roomMaintenance';
import { isRoomAccessLost, ROOM_UNAVAILABLE_MESSAGE } from '../core/roomAccess';
import { getResponseTimeoutSeconds, RESPONSE_TIMEOUT_OPTIONS } from '../core/responseTiming';
import AvatarPicker from './AvatarPicker';
import CouncilTable from './CouncilTable';

interface LobbyProps {
  user: User;
  onLogout: () => void;
  onGameStart: (roomId: string) => void;
  onShowRules: () => void;
}

export default function Lobby({ user, onLogout, onGameStart, onShowRules }: LobbyProps) {
  const { notify, confirm } = useDialog();
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [avatarId, setAvatarId] = useState<PlayerAvatarId | null>(() => {
    const saved = localStorage.getItem('coup_avatar_id');
    return saved === 'male' || saved === 'female' ? saved : null;
  });
  const [currentRoom, setCurrentRoom] = useState<string | null>(localStorage.getItem('coup_current_room') || null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [ownerUid, setOwnerUid] = useState('');
  const [roomStatus, setRoomStatus] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [responseTimeoutSeconds, setResponseTimeoutSeconds] = useState(15);
  const leavingRoom = useRef(false);
  const invalidatedRoom = useRef<string | null>(null);
  const isAdmin = ownerUid === user.token;

  const clearCurrentRoom = useCallback(() => {
    leavingRoom.current = false;
    localStorage.removeItem('coup_current_room');
    setCurrentRoom(null);
    setPlayers([]);
    setOwnerUid('');
    setRoomStatus(null);
  }, []);

  useEffect(() => {
    if (!currentRoom) { invalidatedRoom.current = null; return; }
    let active = true;
    const forgetRoom = (message: string) => {
      if (!active || leavingRoom.current || invalidatedRoom.current === currentRoom) return;
      invalidatedRoom.current = currentRoom;
      active = false;
      clearCurrentRoom();
      notify(message);
    };
    const handleSnapshotError = (error: unknown) => {
      if (!active || leavingRoom.current) return;
      if (isRoomAccessLost(error)) forgetRoom(ROOM_UNAVAILABLE_MESSAGE);
      else notify(getCallableMessage(error));
    };
    const roomRef = doc(db, 'rooms', currentRoom);
    const playersRef = collection(db, `rooms/${currentRoom}/players`);
    const unsubRoom = onSnapshot(roomRef, { includeMetadataChanges: true }, snapshot => {
      if (!active) return;
      const fromCache = snapshot.metadata?.fromCache;
      if (!snapshot.exists()) {
        if (fromCache) return;
        forgetRoom(ROOM_UNAVAILABLE_MESSAGE);
        return;
      }
      const data = snapshot.data();
      const nextOwnerUid = typeof data.adminId === 'string' ? data.adminId : '';
      setOwnerUid(nextOwnerUid);
      setRoomStatus(data.status ?? null);
      setResponseTimeoutSeconds(getResponseTimeoutSeconds(data.responseTimeoutSeconds));
      if (data.status === 'playing') onGameStart(currentRoom);
    }, handleSnapshotError);
    const unsubPlayers = onSnapshot(playersRef, snapshot => {
      if (!active) return;
      let amIStillHere = false;
      const playerList: Player[] = [];
      snapshot.forEach(playerSnapshot => {
        if (playerSnapshot.id === user.token) amIStillHere = true;
        playerList.push({ id: playerSnapshot.id, ...playerSnapshot.data() } as Player);
      });
      if (!amIStillHere && snapshot.docs.length > 0 && !leavingRoom.current) {
        if (snapshot.metadata?.fromCache) return;
        forgetRoom('เจ้าของห้องนำคุณออกจากห้องแล้ว');
        return;
      }
      setPlayers(playerList);
    }, handleSnapshotError);
    return () => { active = false; unsubRoom(); unsubPlayers(); };
  }, [currentRoom, user.token, onGameStart, clearCurrentRoom, notify]);

  useEffect(() => {
    if (!currentRoom || roomStatus !== 'lobby') return;
    return watchLobbyMaintenance(currentRoom, user.token);
  }, [currentRoom, roomStatus, user.token]);

  const handleAvatarChange = (value: PlayerAvatarId) => {
    setAvatarId(value);
    localStorage.setItem('coup_avatar_id', value);
  };

  const handleCreateRoom = async () => {
    if (!avatarId) return notify('กรุณาเลือกตัวละครก่อนสร้างห้อง');
    setIsProcessing(true);
    try {
      const { roomCode } = await createRoom(user.name, avatarId, user.token);
      localStorage.setItem('coup_current_room', roomCode);
      setCurrentRoom(roomCode);
    } catch (error) { notify(getCallableMessage(error)); }
    finally { setIsProcessing(false); }
  };

  const handleJoinRoom = async () => {
    const code = roomCodeInput.toUpperCase().trim();
    if (!avatarId) return notify('กรุณาเลือกตัวละครก่อนเข้าห้อง');
    if (code.length !== 8) return notify('กรุณากรอกรหัสห้องให้ครบ 8 ตัวอักษร');
    setIsProcessing(true);
    try {
      await joinRoom(code, user.name, avatarId, user.token);
      localStorage.setItem('coup_current_room', code);
      setCurrentRoom(code);
    } catch (error) { notify(getCallableMessage(error)); }
    finally { setIsProcessing(false); }
  };

  const handleLeaveRoom = async () => {
    if (!currentRoom) return;
    setIsProcessing(true);
    leavingRoom.current = true;
    try {
      await leaveRoom(currentRoom, user.token);
      clearCurrentRoom();
    } catch (error) {
      leavingRoom.current = false;
      if (isRoomAccessLost(error)) clearCurrentRoom();
      else notify(getCallableMessage(error));
    } finally { setIsProcessing(false); }
  };

  const handleKickPlayer = async (playerId: string, playerName: string) => {
    if (!currentRoom || !await confirm(`ต้องการนำ ${playerName} ออกจากห้องหรือไม่?`)) return;
    try { await kickPlayer(currentRoom, playerId, user.token); }
    catch (error) { notify(getCallableMessage(error)); }
  };

  const handleReadyChange = async (ready: boolean) => {
    if (!currentRoom) return;
    setIsProcessing(true);
    try { await setPlayerReady(currentRoom, ready, user.token); }
    catch (error) { notify(getCallableMessage(error)); }
    finally { setIsProcessing(false); }
  };

  const handleTimeoutChange = async (seconds: number) => {
    if (!currentRoom || !isAdmin) return;
    setIsProcessing(true);
    try { await setResponseTimeout(currentRoom, seconds, user.token); }
    catch (error) { notify(getCallableMessage(error)); }
    finally { setIsProcessing(false); }
  };

  const handleStartGame = async () => {
    if (!currentRoom) return;
    setIsProcessing(true);
    try { await startGame(currentRoom, user.token); }
    catch (error) { notify(getCallableMessage(error)); }
    finally { setIsProcessing(false); }
  };

  const handleCopyCode = async () => {
    if (!currentRoom) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(currentRoom);
      else throw new Error('Clipboard API unavailable');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      const field = document.createElement('textarea');
      field.value = currentRoom;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.append(field);
      field.select();
      const copiedToClipboard = document.execCommand('copy');
      field.remove();
      if (copiedToClipboard) {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      } else notify(`คัดลอกรหัสห้องไม่สำเร็จ: ${currentRoom}`);
    }
  };

  if (currentRoom) {
    const everyoneReady = players.length > 0 && players.every(player => player.isReady === true);
    const canStart = roomStatus === 'lobby' && players.length >= 2 && players.length <= 6 && everyoneReady;
    const startReason = players.length < 2
      ? 'ต้องมีผู้เล่นอย่างน้อย 2 คน'
      : players.length > 6
        ? 'จำนวนผู้เล่นเกินกำหนด'
        : !everyoneReady
          ? 'รอผู้เล่นทุกคนกดพร้อม'
          : roomStatus !== 'lobby'
            ? 'ห้องนี้ไม่ได้อยู่ในสถานะล็อบบี้'
            : '';

    return (
      <main className="lobby-bg lobby-room-page fixed inset-0 z-10 overflow-y-auto px-4 py-5 sm:px-6 sm:py-8">
        <section className="lobby-card lobby-card-room">
          <header className="room-heading">
            <div>
              <p className="eyebrow">THE SECRET COUNCIL</p>
              <h1>โต๊ะสภาลับ</h1>
              <p>ห้องจะเริ่มเมื่อสมาชิกทุกคนยืนยันว่าพร้อมแล้ว</p>
            </div>
            <div className="room-code-panel">
              <span>รหัสห้อง</span>
              <strong className="room-code-value">{currentRoom}</strong>
              <button type="button" className="button-secondary copy-code-button" onClick={() => void handleCopyCode()}>
                {copied ? 'คัดลอกแล้ว' : 'คัดลอกรหัส'}
              </button>
            </div>
          </header>

          <p className="room-privacy-note">
            ระบบตรวจและดำเนินเกมบนอุปกรณ์เจ้าของห้อง เขาจึงอาจเห็นหรือแก้ข้อมูลไพ่ได้ ควรเล่นกับคนที่ไว้ใจ
          </p>

          <div className="lobby-room-summary" aria-live="polite">
            <strong>ผู้เล่น {players.length}/6</strong>
            <span>พร้อมเล่น {players.filter(player => player.isReady === true).length}/{players.length}</span>
          </div>

          <section className="room-time-settings" aria-labelledby="response-time-label">
            <div><label id="response-time-label" htmlFor={isAdmin ? 'response-time' : undefined}>เวลาตอบโต้</label>
              <p>สำหรับยอมผ่าน จับโกหก และบล็อก · หมดเวลาเท่ากับยอมผ่าน</p></div>
            {isAdmin ? <select id="response-time" value={responseTimeoutSeconds}
              disabled={isProcessing || roomStatus !== 'lobby'}
              onChange={event => void handleTimeoutChange(Number(event.target.value))}>
              {RESPONSE_TIMEOUT_OPTIONS.map(seconds => <option key={seconds} value={seconds}>{seconds} วินาที</option>)}
            </select> : <strong>{responseTimeoutSeconds} วินาที <small>เจ้าของห้องเป็นผู้ตั้ง</small></strong>}
          </section>

          <CouncilTable players={players} viewerUid={user.token} ownerUid={ownerUid} isProcessing={isProcessing}
            onReadyChange={handleReadyChange} onKick={handleKickPlayer} />

          <footer className="room-controls">
            <button type="button" className="button-secondary" onClick={onShowRules}>วิธีเล่นและกติกา</button>
            <div className="room-owner-controls">
              {isAdmin && <div className="start-control">
                <button type="button" className="button-primary start-game-button" disabled={!canStart || isProcessing}
                  onClick={() => void handleStartGame()}>เริ่มเกม</button>
                {!canStart && <span className="start-disabled-reason">{startReason}</span>}
              </div>}
              <button type="button" className="button-secondary leave-room-button" disabled={isProcessing}
                onClick={() => void handleLeaveRoom()}>ออกจากห้อง</button>
            </div>
          </footer>
        </section>
      </main>
    );
  }

  return (
    <main className="lobby-bg lobby-entry-page council-entry fixed inset-0 z-10 overflow-y-auto">
      <header className="council-entry-header">
        <span className="council-brand">COUP <small>THE SECRET COUNCIL</small></span>
        <nav className="council-entry-nav" aria-label="เมนูล็อบบี้">
          <button type="button" className="council-rules-button" onClick={onShowRules}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Zm0 0v15" /></svg>วิธีเล่นและกติกา</button>
          <button type="button" className="button-text" onClick={onLogout}>ออกจากระบบ</button>
        </nav>
      </header>
      <section className="lobby-card lobby-card-entry">
        <header className="entry-heading">
          <p className="eyebrow">THE COUNCIL AWAITS</p>
          <h1>เลือกเข้าสู่สภา</h1>
          <p>สร้างห้องแล้วชวนเพื่อน หรือเข้าร่วมด้วยรหัสที่ได้รับ</p>
        </header>
        <div className="council-identity"><div className="council-player"><span>ผู้เล่น</span><strong>{user.name}</strong><small>เลือกตัวละครที่จะใช้ในห้อง</small></div>
        <AvatarPicker value={avatarId} onChange={handleAvatarChange} />
        </div>
        <div className="lobby-entry-actions">
          <section className="room-route room-route-create" aria-labelledby="create-room-title">
            <div className="route-art route-art-council" aria-hidden="true" />
            <p className="route-kicker">ชวนเพื่อนมาที่โต๊ะของคุณ</p>
            <h2 id="create-room-title">สร้างห้องใหม่</h2>
            <p className="route-description">เปิดโต๊ะสภาลับ แล้วส่งรหัสห้องให้เพื่อน<br />เริ่มเกมได้เมื่อมีผู้เล่น 2–6 คนพร้อมเล่น</p>
            <div className="route-bottom"><p className="route-detail">คุณจะเป็นเจ้าของห้อง</p>
          <button type="button" className="button-primary" disabled={isProcessing || !avatarId} onClick={() => void handleCreateRoom()}>
            {isProcessing ? 'กำลังดำเนินการ…' : 'สร้างห้องใหม่'}
          </button>
            </div>
          </section>
          <section className="room-route room-route-join" aria-labelledby="join-room-title">
            <div className="route-art route-art-city" aria-hidden="true" />
            <p className="route-kicker">มีเพื่อนเปิดห้องไว้แล้ว</p>
            <h2 id="join-room-title">เข้าร่วมด้วยรหัส</h2>
            <p className="route-description">รับรหัสจากเจ้าของห้อง<br />แล้วกรอกด้านล่างเพื่อเข้าร่วมโต๊ะเดียวกัน</p>
          <div className="join-room-form">
            <label htmlFor="room-code">เข้าร่วมด้วยรหัสห้อง 8 ตัวอักษร</label>
            <input id="room-code" className="room-code-input" type="text" placeholder="เช่น ABCDEFGH" maxLength={8} value={roomCodeInput}
              autoCapitalize="characters" autoComplete="off" spellCheck={false}
              onChange={event => setRoomCodeInput(event.target.value.replace(/[^a-hj-np-z]/gi, '').toUpperCase())}
              onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void handleJoinRoom(); } }} />
            <button type="button" className="button-secondary" disabled={isProcessing || !avatarId || roomCodeInput.length !== 8}
              onClick={() => void handleJoinRoom()}>เข้าห้อง</button>
          </div>
          </section>
        </div>
        {!avatarId && <p className="route-selection-note" role="status">เลือกตัวละครด้านบนก่อนสร้างห้องหรือเข้าร่วม</p>}
        <div className="entry-footer-actions">
          <span>ผู้เล่น 2–6 คน · ทุกคนต้องกดพร้อมก่อนเริ่ม</span>
        </div>
        <details className="council-room-note"><summary>ห้องที่ไม่มีการใช้งานจะปิดเมื่อใด?</summary><p className="lobby-maintenance-note">ล็อบบี้ที่ไม่มีการจัดการครบ 30 นาทีจะปิดเมื่อมีสมาชิกเปิดหน้าเว็บอยู่ หากทุกคนปิดหน้า ระบบจะตรวจเมื่อมีสมาชิกกลับมา</p></details>
      </section>
      <footer className="council-entry-footer">ซ่อนไพ่ อ่านใจ ชิงอำนาจ</footer>
    </main>
  );
}
