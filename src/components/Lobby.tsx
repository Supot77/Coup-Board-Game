import { useDialog } from './DialogProvider';
import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, collection, onSnapshot } from "firebase/firestore";
import { db } from '../core/firebase';
import { User, Player } from '../types';
import { createRoom, getCallableMessage, joinRoom, kickPlayer, leaveRoom, startGame } from '../core/roomCommands';
import { watchLobbyMaintenance } from '../core/roomMaintenance';

interface LobbyProps {
  user: User;
  onLogout: () => void;
  onGameStart: (roomId: string) => void;
  onShowRules: () => void;
}

export default function Lobby({ user, onLogout, onGameStart, onShowRules }: LobbyProps) {
  const { notify, confirm } = useDialog();
  const [roomCodeInput, setRoomCodeInput] = useState<string>('');
  const [currentRoom, setCurrentRoom] = useState<string | null>(localStorage.getItem('coup_current_room') || null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [roomStatus, setRoomStatus] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const leavingRoom = useRef(false);

  const clearCurrentRoom = useCallback(() => {
    leavingRoom.current = false;
    localStorage.removeItem('coup_current_room');
    setCurrentRoom(null);
    setPlayers([]);
    setRoomStatus(null);
  }, []);

  useEffect(() => {
    if (!currentRoom) return;
    const roomRef = doc(db, "rooms", currentRoom);
    const playersRef = collection(db, `rooms/${currentRoom}/players`);
    const unsubRoom = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsAdmin(data.adminId === user.token);
        setRoomStatus(data.status ?? null);
        if (data.status === "playing") onGameStart(currentRoom);
      } else {
        notify("ห้องนี้ปิดแล้ว กรุณาสร้างห้องใหม่หรือเข้าห้องอื่น");
        clearCurrentRoom();
      }
    });
    const unsubPlayers = onSnapshot(playersRef, (snapshot) => {
      let amIStillHere = false;
      const playerList = [];
      snapshot.forEach((docSnap) => {
        if (docSnap.id === user.token) amIStillHere = true;
        playerList.push({ id: docSnap.id, ...docSnap.data() });
      });
      if (!amIStillHere && snapshot.docs.length > 0 && !leavingRoom.current) {
        notify("เจ้าของห้องนำคุณออกจากห้องแล้ว");
        clearCurrentRoom();
        return;
      }
      setPlayers(playerList);
    });
    return () => { unsubRoom(); unsubPlayers(); };
  }, [currentRoom, user.token, onGameStart, clearCurrentRoom, notify]);

  useEffect(() => {
    if (!currentRoom || roomStatus !== 'lobby') return;
    return watchLobbyMaintenance(currentRoom, user.token);
  }, [currentRoom, roomStatus, user.token]);

  const handleCreateRoom = async () => {
    setIsProcessing(true);
    try {
      const { roomCode } = await createRoom(user.name, user.token);
      localStorage.setItem('coup_current_room', roomCode);
      setCurrentRoom(roomCode);
    } catch (error) { notify(getCallableMessage(error)); }
    finally { setIsProcessing(false); }
  };

  const handleJoinRoom = async () => {
    const code = roomCodeInput.toUpperCase().trim();
    if (code.length !== 8) return notify("กรุณากรอกรหัสห้องให้ครบ 8 ตัวอักษร");
    setIsProcessing(true);
    try {
      await joinRoom(code, user.name, user.token);
      localStorage.setItem('coup_current_room', code);
      setCurrentRoom(code);
    } catch (error) { notify(getCallableMessage(error)); }
    finally { setIsProcessing(false); }
  };

  const handleLeaveRoom = async () => {
    setIsProcessing(true);
    leavingRoom.current = true;
    if (currentRoom) {
      try { await leaveRoom(currentRoom, user.token); }
      catch (error) { leavingRoom.current = false; notify(getCallableMessage(error)); setIsProcessing(false); return; }
    }
    clearCurrentRoom();
    setIsProcessing(false);
  };

  const handleKickPlayer = async (playerId: string, playerName: string) => {
    if(await confirm(`ต้องการนำ ${playerName} ออกจากห้องหรือไม่?`)) {
      try { await kickPlayer(currentRoom!, playerId, user.token); }
      catch (error) { notify(getCallableMessage(error)); }
    }
  };

  const handleStartGame = async () => {
    if (!currentRoom) return;
    setIsProcessing(true);
    try { await startGame(currentRoom, user.token); }
    catch (error) { notify(getCallableMessage(error)); }
    finally { setIsProcessing(false); }
  };

  if (currentRoom) {
    return (
      <div className="lobby-bg bg-[url('/bg-lobby.jpg')] bg-cover bg-center bg-no-repeat fixed top-0 left-0 w-screen h-screen flex items-center justify-center z-10 px-4">
        <div className="lobby-card lobby-card-room max-w-[450px] bg-[rgba(5,5,5,0.65)] border border-[rgba(241,196,15,0.4)] shadow-[0_0_40px_rgba(0,0,0,0.8),inset_0_0_20px_rgba(241,196,15,0.05)] backdrop-blur-[20px] backdrop-saturate-[120%] w-full rounded-[24px] p-[40px] text-center m-0">
          <h2 className="text-white mt-0 font-medium text-2xl mb-4">
            รหัสห้อง: <span className="text-gold tracking-[2px]">{currentRoom}</span>
          </h2>
          <p className="text-xs leading-5 text-white/65 mb-4">
            ระบบตรวจและดำเนินเกมบนอุปกรณ์เจ้าของห้อง เขาจึงอาจเห็นหรือแก้ข้อมูลไพ่ได้ ควรเล่นกับคนที่ไว้ใจ
          </p>
          <div className="bg-[rgba(0,0,0,0.4)] border border-[rgba(241,196,15,0.15)] rounded-[16px] p-[24px]">
            <h3 className="m-0 mb-[15px] text-gold border-b border-[rgba(241,196,15,0.3)] pb-[10px] text-lg font-medium">
              ผู้เล่น ({players.length}/6)
            </h3>
            <ul className="list-none p-0 m-0">
              {players.map(p => (
                <li key={p.id} className="py-[14px] px-[8px] border-b border-[rgba(255,255,255,0.08)] last:border-b-0 flex justify-between items-center">
                  <span className="text-white text-[17px]">
                    {p.name} {p.id === user.token ? <span className="text-gold">(คุณ)</span> : ""}
                  </span>
                  {isAdmin && p.id !== user.token && (
                    <button className="bg-transparent text-[#e74c3c] border border-[#e74c3c] py-[6px] px-[12px] text-[13px] m-0 cursor-pointer hover:bg-[rgba(231,76,60,0.15)] rounded" onClick={() => handleKickPlayer(p.id, p.name)}>นำออก</button>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-[12px] mt-[20px]">
            <button className="utility-button" onClick={onShowRules}>วิธีเล่นและกติกา</button>
            {isAdmin && (
              <button 
                className="bg-[linear-gradient(135deg,#ffbc1f_0%,#ffbc1f_100%)] text-[#000000] w-full text-[18px] tracking-[0.5px] border border-[rgba(241,196,15,0.3)] shadow-[0_4px_15px_rgba(0,0,0,0.5)] m-0 p-2 cursor-pointer hover:not-disabled:bg-[linear-gradient(135deg,#ffffff_0%,#ffffff_0%)] hover:not-disabled:border-[rgba(241,196,15,0.6)] hover:not-disabled:scale-[0.98] hover:not-disabled:shadow-[0_2px_8px_rgba(0,0,0,0.8)] rounded disabled:opacity-50 disabled:cursor-not-allowed" 
                disabled={players.length < 2 || isProcessing}
                onClick={handleStartGame}
              >
                {players.length < 2 ? "รอผู้เล่นให้ครบอย่างน้อย 2 คน" : "เริ่มเกม"}
              </button>
            )}
            <button disabled={isProcessing} className="bg-transparent text-[#86868b] border border-[rgba(255,255,255,0.15)] w-full m-0 p-2 cursor-pointer hover:bg-[rgba(255,255,255,0.1)] hover:text-white rounded" onClick={handleLeaveRoom}>ออกจากห้อง</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lobby-bg bg-[url('/bg-lobby.jpg')] bg-cover bg-center bg-no-repeat fixed top-0 left-0 w-screen h-screen flex items-center justify-center z-10 px-4">
      <div className="lobby-card max-w-[450px] bg-[rgba(5,5,5,0.65)] border border-[rgba(241,196,15,0.4)] shadow-[0_0_40px_rgba(0,0,0,0.8),inset_0_0_20px_rgba(241,196,15,0.05)] backdrop-blur-[20px] backdrop-saturate-[120%] w-full rounded-[24px] p-[40px] text-center m-0">
        <h2 className="text-gold m-0 mb-[5px] text-[32px] tracking-[1px] font-medium">ล็อบบี้</h2>
        <p className="text-[#ccc] mb-[30px] text-[15px]">
          ผู้เล่น: <b className="text-white">{user.name}</b>
        </p>
        <p className="text-xs leading-5 text-white/65 mb-4">
          ล็อบบี้ที่ไม่มีการจัดการครบ 30 นาทีจะปิดเมื่อมีสมาชิกเปิดหน้าเว็บอยู่ หากทุกคนปิดหน้า ระบบจะตรวจเมื่อมีสมาชิกกลับมา
        </p>
        <div className="bg-[rgba(0,0,0,0.4)] border border-[rgba(241,196,15,0.15)] rounded-[16px] p-[24px]">
          <button disabled={isProcessing} className="bg-[linear-gradient(135deg,#ffbc1f_0%,#ffbc1f_100%)] text-[#000000] w-full text-[18px] tracking-[0.5px] border border-[rgba(241,196,15,0.3)] shadow-[0_4px_15px_rgba(0,0,0,0.5)] m-0 p-2 cursor-pointer hover:not-disabled:bg-[linear-gradient(135deg,#ffffff_0%,#ffffff_0%)] hover:not-disabled:border-[rgba(241,196,15,0.6)] hover:not-disabled:scale-[0.98] hover:not-disabled:shadow-[0_2px_8px_rgba(0,0,0,0.8)] rounded" onClick={handleCreateRoom}>สร้างห้องใหม่</button>
        </div>
        <div className="bg-[rgba(0,0,0,0.4)] border border-[rgba(241,196,15,0.15)] rounded-[16px] p-[24px] mt-[20px]">
          <label htmlFor="room-code" className="block text-sm text-white/80 mb-2">รหัสห้อง 8 ตัวอักษร</label>
          <input id="room-code" type="text" placeholder="เช่น ABCDEFGH" maxLength={8} value={roomCodeInput}
            autoCapitalize="characters" autoComplete="off" spellCheck={false}
            onChange={(e) => setRoomCodeInput(e.target.value.replace(/[^a-hj-np-z]/gi, '').toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleJoinRoom(); } }}
            className="room-code-input text-center text-[20px] bg-[rgba(0,0,0,0.5)] border border-[rgba(255,255,255,0.1)] mb-[15px] text-gold placeholder:text-[#999] focus:bg-[rgba(0,0,0,0.8)] focus:border-gold focus:shadow-[0_0_0_4px_rgba(241,196,15,0.15)] outline-none w-full p-2 rounded"
          />
          <button disabled={isProcessing} className="bg-[rgba(241,196,15,0.05)] text-gold border border-gold w-full m-0 p-2 cursor-pointer hover:bg-[rgba(241,196,15,0.2)] rounded" onClick={handleJoinRoom}>เข้าห้อง</button>
        </div>
        <button className="utility-button w-full mt-4" onClick={onShowRules}>วิธีเล่นและกติกา</button>
        <button className="bg-transparent text-[#86868b] border border-[rgba(255,255,255,0.15)] w-full m-0 p-2 cursor-pointer hover:bg-[rgba(255,255,255,0.1)] hover:text-white rounded mt-[25px]" onClick={onLogout}>ออกจากระบบ</button>
      </div>
    </div>
  );
}
