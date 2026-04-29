import { useState, useEffect } from 'react';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, onSnapshot } from "firebase/firestore";
import { db } from '../core/firebase';

export default function Lobby({ user, onLogout, onGameStart }) {
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [currentRoom, setCurrentRoom] = useState(localStorage.getItem('coup_current_room') || null);
  const [players, setPlayers] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // ฟังก์ชันสุ่มรหัส 4 หลัก
  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 4; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
  };

  // ดักฟังข้อมูล Real-time จาก Firebase เมื่อมี currentRoom
  useEffect(() => {
    if (!currentRoom) return;

    const roomRef = doc(db, "rooms", currentRoom);
    const playersRef = collection(db, `rooms/${currentRoom}/players`);

    // 1. ดักฟังสถานะห้อง
    const unsubRoom = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsAdmin(data.adminId === user.token);
        
        // ถ้าห้องถูกเปลี่ยนสถานะเป็น playing ให้สั่ง App.jsx สลับไปหน้าเกม
        if (data.status === "playing") {
          onGameStart(currentRoom);
        }
      } else {
        alert("ห้องนี้ถูกปิดไปแล้วครับ");
        handleLeaveRoom();
      }
    });

    // 2. ดักฟังรายชื่อผู้เล่น
    const unsubPlayers = onSnapshot(playersRef, (snapshot) => {
      let amIStillHere = false;
      const playerList = [];

      snapshot.forEach((docSnap) => {
        if (docSnap.id === user.token) amIStillHere = true;
        playerList.push({ id: docSnap.id, ...docSnap.data() });
      });

      // ถ้าไม่มีชื่อเราในห้องแล้ว (โดนเตะ)
      if (!amIStillHere && snapshot.docs.length > 0) {
        alert("คุณถูกเตะออกจากห้อง!");
        handleLeaveRoom();
        return;
      }

      setPlayers(playerList);
    });

    // คืนค่าฟังก์ชันสำหรับยกเลิกการดักฟังเมื่อเปลี่ยนหน้า หรือออกจากห้อง
    return () => {
      unsubRoom();
      unsubPlayers();
    };
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
    if(window.confirm(`ต้องการเตะ ${playerName} ใช่ไหม?`)) {
      await deleteDoc(doc(db, `rooms/${currentRoom}/players`, playerId));
    }
  };

  const handleStartGame = async () => {
    // สับไพ่เตรียมไว้เลยตั้งแต่ตอนกดเริ่มเกม
    const baseDeck = ['Duke','Duke','Duke', 'Assassin','Assassin','Assassin', 'Captain','Captain','Captain', 'Ambassador','Ambassador','Ambassador', 'Contessa','Contessa','Contessa'];
    const shuffledDeck = baseDeck.sort(() => Math.random() - 0.5);
    try { 
      await updateDoc(doc(db, "rooms", currentRoom), { status: "playing", deck: shuffledDeck, gameState: "setup_phase" }); 
    } catch (error) { console.error(error); }
  };

  // --- ส่วนแสดงผล UI ---
  
  // ถ้าเข้าห้องไปแล้ว โชว์หน้ารายละเอียดห้อง
  if (currentRoom) {
    return (
      <div className="view-container">
        <h2>รหัสห้อง: <span style={{ color: 'var(--gold)' }}>{currentRoom}</span></h2>
        
        <div style={{ backgroundColor: 'var(--light-gray)', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 10px 0' }}>รายชื่อผู้เล่น ({players.length}/6)</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {players.map(p => (
              <li key={p.id} style={{ padding: '8px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>👤 {p.name} {p.id === user.token ? "(คุณ)" : ""}</span>
                {isAdmin && p.id !== user.token && (
                  <button className="danger" style={{ padding: '5px 10px', margin: 0, fontSize: '12px' }} onClick={() => handleKickPlayer(p.id, p.name)}>❌ เตะ</button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {isAdmin && (
          <button 
            className="gold" 
            disabled={players.length < 2} 
            onClick={handleStartGame}
          >
            {players.length < 2 ? "รอผู้เล่น... (ต้องมี 2 คนขึ้นไป)" : "เริ่มเกม!"}
          </button>
        )}
        <button className="danger" onClick={handleLeaveRoom}>ออกจากห้อง</button>
      </div>
    );
  }

  // ถ้ายังไม่เข้าห้อง โชว์เมนูสร้าง/จอยห้อง
  return (
    <div className="view-container">
      <h2>ระบบจัดการห้อง</h2>
      <p>ยินดีต้อนรับคุณ: <b>{user.name}</b></p>
      
      <div style={{ padding: '20px', border: '2px dashed #ccc', borderRadius: '8px', marginBottom: '15px' }}>
        <button className="primary" onClick={handleCreateRoom}>+ สร้างห้องใหม่</button>
      </div>

      <div style={{ padding: '20px', border: '2px dashed #ccc', borderRadius: '8px', marginBottom: '15px' }}>
        <input 
          type="text" 
          placeholder="ใส่รหัสห้อง 4 หลัก" 
          maxLength="4" 
          value={roomCodeInput}
          onChange={(e) => setRoomCodeInput(e.target.value)}
          style={{ textTransform: 'uppercase', width: '150px' }}
        />
        <br />
        <button className="gold" onClick={handleJoinRoom}>เข้าร่วมห้อง</button>
      </div>

      <button className="danger" onClick={onLogout} style={{ marginTop: '20px' }}>ออกจากระบบ</button>
    </div>
  );
}