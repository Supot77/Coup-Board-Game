import { useState, useEffect } from 'react';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, onSnapshot } from "firebase/firestore";
import { db } from '../core/firebase';
import './Lobby.css';

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

  // --- UI: เมื่ออยู่ในห้องรอเล่น ---
  if (currentRoom) {
    return (
      <div className="lobby-background">
        <div className="view-container glass-effect dark-theme lobby-glass">
          <h2 style={{ color: 'white', marginTop: 0, fontWeight: '500' }}>
            รหัสสภา: <span style={{ color: '#f1c40f', letterSpacing: '2px' }}>{currentRoom}</span>
          </h2>
          
          <div className="lobby-box">
            <h3 style={{ margin: '0 0 15px 0', color: '#f1c40f', borderBottom: '1px solid rgba(241, 196, 15, 0.3)', paddingBottom: '10px' }}>
              ผู้ร่วมโต๊ะสภา ({players.length}/6)
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {players.map(p => (
                <li key={p.id} className="lobby-player-item">
                  <span style={{ color: 'white', fontSize: '17px' }}>
                    {p.name} {p.id === user.token ? <span style={{ color: '#f1c40f' }}>(คุณ)</span> : ""}
                  </span>
                  {isAdmin && p.id !== user.token && (
                    <button className="danger-outline" onClick={() => handleKickPlayer(p.id, p.name)}>❌ ขับไล่</button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
            {isAdmin && (
              <button className="primary" disabled={players.length < 2} onClick={handleStartGame}>
                {players.length < 2 ? "รอผู้เข้าร่วม... (ต้องมี 2 คนขึ้นไป)" : "เริ่มการประชุม (Start Game)"}
              </button>
            )}
            <button className="transparent-btn" onClick={handleLeaveRoom}>ลุกจากโต๊ะ (ออกจากสภา)</button>
          </div>
        </div>
      </div>
    );
  }

  // --- UI: เมนูสร้าง/เข้าร่วม ---
  return (
    <div className="lobby-background">
      <div className="view-container glass-effect dark-theme lobby-glass">
        <h2 style={{ color: '#f1c40f', margin: '0 0 5px 0', fontSize: '32px', letterSpacing: '1px' }}>สภาลับ</h2>
        <p style={{ color: '#ccc', marginBottom: '30px', fontSize: '15px' }}>
          ยินดีต้อนรับท่าน: <b style={{ color: 'white' }}>{user.name}</b>
        </p>
        
        <div className="lobby-action-box">
          <button className="primary" onClick={handleCreateRoom}>+ สร้างสภาใหม่</button>
        </div>

        <div className="lobby-action-box" style={{ marginTop: '20px' }}>
          <input 
            type="text" 
            placeholder="รหัส 4 หลัก" 
            maxLength="4" 
            value={roomCodeInput}
            onChange={(e) => setRoomCodeInput(e.target.value)}
            style={{ textTransform: 'uppercase', textAlign: 'center', letterSpacing: '6px', fontSize: '20px' }}
          />
          <button className="gold-outline" onClick={handleJoinRoom}>เข้าร่วมสภา</button>
        </div>

        <button className="transparent-btn" onClick={onLogout} style={{ marginTop: '25px' }}>ออกจากระบบ</button>
      </div>
    </div>
  );
}