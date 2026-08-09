import { useState, useEffect } from 'react';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, onSnapshot } from "firebase/firestore";
import { db } from '../core/firebase';

export default function Lobby({ user, onLogout, onGameStart }) {
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [currentRoom, setCurrentRoom] = useState(localStorage.getItem('coup_current_room') || null);
  const [players, setPlayers] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 4; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
  };

  useEffect(() => {
    if (!currentRoom) return;
    const roomRef = doc(db, "rooms", currentRoom);
    const playersRef = collection(db, `rooms/${currentRoom}/players`);
    const unsubRoom = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsAdmin(data.adminId === user.token);
        if (data.status === "playing") onGameStart(currentRoom);
      } else {
        alert("ห้องนี้ถูกปิดไปแล้วครับ");
        handleLeaveRoom();
      }
    });
    const unsubPlayers = onSnapshot(playersRef, (snapshot) => {
      let amIStillHere = false;
      const playerList = [];
      snapshot.forEach((docSnap) => {
        if (docSnap.id === user.token) amIStillHere = true;
        playerList.push({ id: docSnap.id, ...docSnap.data() });
      });
      if (!amIStillHere && snapshot.docs.length > 0) {
        alert("คุณถูกเชิญออกจากโต๊ะสภา!");
        handleLeaveRoom();
        return;
      }
      setPlayers(playerList);
    });
    return () => { unsubRoom(); unsubPlayers(); };
  }, [currentRoom, user.token, onGameStart]);

  const handleCreateRoom = async () => {
    const code = generateRoomCode();
    try {
      await setDoc(doc(db, "rooms", code), { status: "lobby", adminId: user.token, createdAt: new Date() });
      await setDoc(doc(db, `rooms/${code}/players`, user.token), { name: user.name, role: "player", isDead: false, coins: 2, cards: [] });
      localStorage.setItem('coup_current_room', code);
      setCurrentRoom(code);
    } catch (error) { console.error(error); }
  };

  const handleJoinRoom = async () => {
    const code = roomCodeInput.toUpperCase().trim();
    if (code.length !== 4) return alert("รหัสห้องต้องมี 4 หลัก");
    try {
      const roomSnap = await getDoc(doc(db, "rooms", code));
      if (!roomSnap.exists()) return alert("ไม่พบห้องนี้!");
      await setDoc(doc(db, `rooms/${code}/players`, user.token), { name: user.name, role: "player", isDead: false, coins: 2, cards: [] }, { merge: true });
      localStorage.setItem('coup_current_room', code);
      setCurrentRoom(code);
    } catch (error) { console.error(error); }
  };

  const handleLeaveRoom = async () => {
    if (currentRoom) {
      try { await deleteDoc(doc(db, `rooms/${currentRoom}/players`, user.token)); } catch (error) {}
    }
    localStorage.removeItem('coup_current_room');
    setCurrentRoom(null);
    setPlayers([]);
  };

  const handleKickPlayer = async (playerId, playerName) => {
    if(window.confirm(`ต้องการไล่ ${playerName} ออกจากสภาหรือไม่?`)) {
      await deleteDoc(doc(db, `rooms/${currentRoom}/players`, playerId));
    }
  };

  const handleStartGame = async () => {
    const baseDeck = ['Duke','Duke','Duke', 'Assassin','Assassin','Assassin', 'Captain','Captain','Captain', 'Ambassador','Ambassador','Ambassador', 'Contessa','Contessa','Contessa'];
    const shuffledDeck = baseDeck.sort(() => Math.random() - 0.5);
    try { 
      await updateDoc(doc(db, "rooms", currentRoom), { status: "playing", deck: shuffledDeck, gameState: "setup_phase" }); 
    } catch (error) { console.error(error); }
  };

  if (currentRoom) {
    return (
      <div className="lobby-bg bg-[url('/bg-lobby.jpg')] bg-cover bg-center bg-no-repeat fixed top-0 left-0 w-screen h-screen flex items-center justify-center z-10 px-4">
        <div className="max-w-[450px] bg-[rgba(5,5,5,0.65)] border border-[rgba(241,196,15,0.4)] shadow-[0_0_40px_rgba(0,0,0,0.8),inset_0_0_20px_rgba(241,196,15,0.05)] backdrop-blur-[20px] backdrop-saturate-[120%] w-full rounded-[24px] p-[40px] text-center m-0">
          <h2 className="text-white mt-0 font-medium text-2xl mb-4">
            รหัสสภา: <span className="text-gold tracking-[2px]">{currentRoom}</span>
          </h2>
          <div className="bg-[rgba(0,0,0,0.4)] border border-[rgba(241,196,15,0.15)] rounded-[16px] p-[24px]">
            <h3 className="m-0 mb-[15px] text-gold border-b border-[rgba(241,196,15,0.3)] pb-[10px] text-lg font-medium">
              ผู้ร่วมโต๊ะสภา ({players.length}/6)
            </h3>
            <ul className="list-none p-0 m-0">
              {players.map(p => (
                <li key={p.id} className="py-[14px] px-[8px] border-b border-[rgba(255,255,255,0.08)] last:border-b-0 flex justify-between items-center">
                  <span className="text-white text-[17px]">
                    {p.name} {p.id === user.token ? <span className="text-gold">(คุณ)</span> : ""}
                  </span>
                  {isAdmin && p.id !== user.token && (
                    <button className="bg-transparent text-[#e74c3c] border border-[#e74c3c] py-[6px] px-[12px] text-[13px] m-0 cursor-pointer hover:bg-[rgba(231,76,60,0.15)] rounded" onClick={() => handleKickPlayer(p.id, p.name)}>❌ ขับไล่</button>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-[12px] mt-[20px]">
            {isAdmin && (
              <button 
                className="bg-[linear-gradient(135deg,#ffbc1f_0%,#ffbc1f_100%)] text-[#000000] w-full text-[18px] tracking-[0.5px] border border-[rgba(241,196,15,0.3)] shadow-[0_4px_15px_rgba(0,0,0,0.5)] m-0 p-2 cursor-pointer hover:not-disabled:bg-[linear-gradient(135deg,#ffffff_0%,#ffffff_0%)] hover:not-disabled:border-[rgba(241,196,15,0.6)] hover:not-disabled:scale-[0.98] hover:not-disabled:shadow-[0_2px_8px_rgba(0,0,0,0.8)] rounded disabled:opacity-50 disabled:cursor-not-allowed" 
                disabled={players.length < 2} 
                onClick={handleStartGame}
              >
                {players.length < 2 ? "รอผู้เข้าร่วม... (ต้องมี 2 คนขึ้นไป)" : "เริ่มการประชุม (Start Game)"}
              </button>
            )}
            <button className="bg-transparent text-[#86868b] border border-[rgba(255,255,255,0.15)] w-full m-0 p-2 cursor-pointer hover:bg-[rgba(255,255,255,0.1)] hover:text-white rounded" onClick={handleLeaveRoom}>ลุกจากโต๊ะ (ออกจากสภา)</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lobby-bg bg-[url('/bg-lobby.jpg')] bg-cover bg-center bg-no-repeat fixed top-0 left-0 w-screen h-screen flex items-center justify-center z-10 px-4">
      <div className="max-w-[450px] bg-[rgba(5,5,5,0.65)] border border-[rgba(241,196,15,0.4)] shadow-[0_0_40px_rgba(0,0,0,0.8),inset_0_0_20px_rgba(241,196,15,0.05)] backdrop-blur-[20px] backdrop-saturate-[120%] w-full rounded-[24px] p-[40px] text-center m-0">
        <h2 className="text-gold m-0 mb-[5px] text-[32px] tracking-[1px] font-medium">สภาลับ</h2>
        <p className="text-[#ccc] mb-[30px] text-[15px]">
          ยินดีต้อนรับท่าน: <b className="text-white">{user.name}</b>
        </p>
        <div className="bg-[rgba(0,0,0,0.4)] border border-[rgba(241,196,15,0.15)] rounded-[16px] p-[24px]">
          <button className="bg-[linear-gradient(135deg,#ffbc1f_0%,#ffbc1f_100%)] text-[#000000] w-full text-[18px] tracking-[0.5px] border border-[rgba(241,196,15,0.3)] shadow-[0_4px_15px_rgba(0,0,0,0.5)] m-0 p-2 cursor-pointer hover:not-disabled:bg-[linear-gradient(135deg,#ffffff_0%,#ffffff_0%)] hover:not-disabled:border-[rgba(241,196,15,0.6)] hover:not-disabled:scale-[0.98] hover:not-disabled:shadow-[0_2px_8px_rgba(0,0,0,0.8)] rounded" onClick={handleCreateRoom}>+ สร้างสภาใหม่</button>
        </div>
        <div className="bg-[rgba(0,0,0,0.4)] border border-[rgba(241,196,15,0.15)] rounded-[16px] p-[24px] mt-[20px]">
          <input type="text" placeholder="รหัส 4 หลัก" maxLength="4" value={roomCodeInput}
            onChange={(e) => setRoomCodeInput(e.target.value)}
            className="uppercase text-center tracking-[6px] text-[20px] bg-[rgba(0,0,0,0.5)] border border-[rgba(255,255,255,0.1)] mb-[15px] text-gold placeholder:text-[#666666] focus:bg-[rgba(0,0,0,0.8)] focus:border-gold focus:shadow-[0_0_0_4px_rgba(241,196,15,0.15)] outline-none w-full p-2 rounded"
          />
          <button className="bg-[rgba(241,196,15,0.05)] text-gold border border-gold w-full m-0 p-2 cursor-pointer hover:bg-[rgba(241,196,15,0.2)] rounded" onClick={handleJoinRoom}>เข้าร่วมสภา</button>
        </div>
        <button className="bg-transparent text-[#86868b] border border-[rgba(255,255,255,0.15)] w-full m-0 p-2 cursor-pointer hover:bg-[rgba(255,255,255,0.1)] hover:text-white rounded mt-[25px]" onClick={onLogout}>ออกจากระบบ</button>
      </div>
    </div>
  );
}