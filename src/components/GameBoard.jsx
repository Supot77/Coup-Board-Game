import { useState, useEffect } from 'react';
import { doc, collection, onSnapshot, getDocs, updateDoc, writeBatch, increment, arrayUnion, deleteDoc } from "firebase/firestore";
import { db } from '../core/firebase';
import './GameBoard.css';

// Import ส่วนประกอบย่อย
import VictoryScreen from './VictoryScreen.jsx';
import OpponentList from './OpponentList.jsx';
import ActionLog from './ActionLog.jsx';
import PlayerActionPanel from './PlayerActionPanel.jsx';

export default function GameBoard({ roomCode, user, onLeaveGame, onShowRules }) {
  const [roomData, setRoomData] = useState(null);
  const [players, setPlayers] = useState([]);
  const [targetAction, setTargetAction] = useState(null);
  const [selectedAmbassadorCards, setSelectedAmbassadorCards] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [actionToConfirm, setActionToConfirm] = useState(null);
  const [historyLog, setHistoryLog] = useState([]);

  useEffect(() => {
    const roomRef = doc(db, "rooms", roomCode);
    const playersRef = collection(db, `rooms/${roomCode}/players`);

    const unsubRoom = onSnapshot(roomRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRoomData(data);
        setIsProcessing(false);

        if (data.status === "lobby") {
          onLeaveGame();
          return;
        }

        if (data.actionLog) {
          setHistoryLog(prev => {
            const lastLog = prev[prev.length - 1];
            if (lastLog?.raw !== data.actionLog) {
              const timeString = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
              return [...prev, { raw: data.actionLog, text: `[${timeString}] ${data.actionLog}` }];
            }
            return prev;
          });
        }

        if (data.gameState === "setup_phase" && data.adminId === user.token) {
          const pSnap = await getDocs(playersRef);
          const batch = writeBatch(db);
          let turnOrder = [];
          const baseDeck = ['Duke','Duke','Duke', 'Assassin','Assassin','Assassin', 'Captain','Captain','Captain', 'Ambassador','Ambassador','Ambassador', 'Contessa','Contessa','Contessa'];
          let currentDeck = baseDeck.sort(() => Math.random() - 0.5);

          pSnap.forEach((pDoc) => {
            turnOrder.push(pDoc.id);
            batch.update(pDoc.ref, { 
              cards: [ { character: currentDeck.pop(), isDead: false, id: Date.now()+Math.random() }, 
                       { character: currentDeck.pop(), isDead: false, id: Date.now()+Math.random()+1 } ],
              coins: 2, isDead: false
            });
          });
          batch.update(roomRef, { deck: currentDeck, turnOrder: turnOrder.sort(() => Math.random() - 0.5), currentTurnIndex: 0, gameState: "waiting_for_action", actionLog: "🔥 เริ่มเกมได้! ขอให้โชคดี!" });
          await batch.commit();
        }
      }
    });

    const unsubPlayers = onSnapshot(playersRef, (snapshot) => {
      let pList = [];
      snapshot.forEach(docSnap => pList.push({ id: docSnap.id, ...docSnap.data() }));
      setPlayers(pList);
    });

    return () => { unsubRoom(); unsubPlayers(); };
  }, [roomCode, user.token]);

  const myPlayer = players.find(p => p.id === user.token);
  const alivePlayers = players.filter(p => !p.isDead);
  const isMyTurn = roomData?.turnOrder?.[roomData?.currentTurnIndex] === user.token;
  const gameState = roomData?.gameState;

  useEffect(() => {
    if (gameState !== "game_over" && alivePlayers.length === 1 && players.length > 1) {
      updateDoc(doc(db, "rooms", roomCode), { gameState: "game_over" });
    }
  }, [gameState, alivePlayers.length, players.length, roomCode]);

  useEffect(() => {
    let timer;
    const isWaitingForMe = 
      (gameState === "waiting_for_responses" || gameState === "waiting_for_block_responses") && 
      !roomData?.passVotes?.includes(user.token) &&
      !(gameState === "waiting_for_responses" && roomData?.pendingAction?.sourceId === user.token) &&
      !(gameState === "waiting_for_block_responses" && roomData?.pendingAction?.blockerId === user.token);

    if (isWaitingForMe) {
      setTimeLeft(15);
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleVotePass(); 
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setTimeLeft(null);
    }
    return () => clearInterval(timer);
  }, [gameState, roomData?.passVotes, user.token]);

  useEffect(() => {
    if ((gameState === "waiting_for_responses" && roomData?.pendingAction?.sourceId === user.token) || 
        (gameState === "waiting_for_block_responses" && roomData?.pendingAction?.blockerId === user.token)) {
      if (roomData.passVotes?.length >= alivePlayers.length - 1) {
        if (gameState === "waiting_for_responses") resolveAction(roomData.pendingAction);
        else passTurn(`ทุกคนยอมรับการบล็อก Action ยกเลิก`);
      }
    }
  }, [roomData?.passVotes, gameState, alivePlayers.length]);

  const passTurn = async (msg) => {
    let nextIndex = roomData.currentTurnIndex;
    for (let i = 0; i < roomData.turnOrder.length; i++) {
      nextIndex = (nextIndex + 1) % roomData.turnOrder.length;
      if (!players.find(p => p.id === roomData.turnOrder[nextIndex])?.isDead) break;
    }
    await updateDoc(doc(db, "rooms", roomCode), { currentTurnIndex: nextIndex, gameState: "waiting_for_action", pendingAction: null, passVotes: [], drawnCards: [], actionLog: msg });
  };

  const triggerDiscard = async (targetId, reasonLog, afterState, payload) => {
    await updateDoc(doc(db, "rooms", roomCode), { gameState: "waiting_for_discard", discardTarget: targetId, actionLog: reasonLog, afterDiscardState: afterState, afterDiscardPayload: payload || null });
  };

  const performAction = async (actionName) => {
    if (myPlayer.coins >= 10 && actionName !== "Coup") {
      alert("บังคับใช้ Coup เท่านั้น!");
      setActionToConfirm(null);
      return;
    }
    setIsProcessing(true);
    if (actionName === "Income") {
      await updateDoc(doc(db, `rooms/${roomCode}/players`, user.token), { coins: increment(1) });
      return passTurn(`💰 ${myPlayer.name} รับ Income (+1)`);
    }
    if (["Assassinate", "Steal", "Coup"].includes(actionName)) {
      setTargetAction(actionName); 
      setIsProcessing(false);
      return;
    }
    await updateDoc(doc(db, "rooms", roomCode), {
      gameState: "waiting_for_responses", 
      pendingAction: { actionName, sourceId: user.token, targetId: null, blockerId: null, blockCharacter: null }, 
      passVotes: [], actionLog: `📣 ${myPlayer.name} ประกาศใช้ ${actionName}`
    });
  };

  const handleActionClick = (actionName) => {
    if (["Assassinate", "Coup"].includes(actionName)) setActionToConfirm(actionName);
    else performAction(actionName);
  };

  const handleTargetSelect = async (targetId) => {
    setIsProcessing(true);
    const actionName = targetAction;
    const targetName = players.find(p => p.id === targetId)?.name;
    setTargetAction(null);
    if (actionName === "Coup") {
      await updateDoc(doc(db, `rooms/${roomCode}/players`, user.token), { coins: increment(-7) });
      return triggerDiscard(targetId, `⚔️ ${targetName} โดน Coup จาก ${myPlayer.name}!`, "waiting_for_action", true);
    }
    if (actionName === "Assassinate") await updateDoc(doc(db, `rooms/${roomCode}/players`, user.token), { coins: increment(-3) });
    await updateDoc(doc(db, "rooms", roomCode), {
      gameState: "waiting_for_responses", 
      pendingAction: { actionName, sourceId: user.token, targetId, blockerId: null, blockCharacter: null }, 
      passVotes: [], actionLog: `📣 ${myPlayer.name} ใช้ ${actionName} ใส่ ${targetName}!`
    });
  };

  const handleVotePass = async () => {
    setIsProcessing(true);
    await updateDoc(doc(db, "rooms", roomCode), { passVotes: arrayUnion(user.token) });
  };

  const handleChallenge = async () => {
    setIsProcessing(true);
    const pending = roomData.pendingAction;
    const actionCharacterMap = { "Tax": "Duke", "Assassinate": "Assassin", "Steal": "Captain", "Exchange": "Ambassador" };
    const isChallengingBlock = gameState === "waiting_for_block_responses";
    const targetId = isChallengingBlock ? pending.blockerId : pending.sourceId;
    const claimedChar = isChallengingBlock ? pending.blockCharacter : actionCharacterMap[pending.actionName];
    const targetData = players.find(p => p.id === targetId);
    const hasCard = targetData.cards.some(c => !c.isDead && c.character === claimedChar);
    if (hasCard) triggerDiscard(user.token, `🚨 ท้าพลาด! มี ${claimedChar} จริง!`, isChallengingBlock ? "waiting_for_action" : "resolve_action", isChallengingBlock ? true : pending);
    else triggerDiscard(targetId, `🚨 ท้าสำเร็จ! โกหก ไม่มี ${claimedChar}!`, isChallengingBlock ? "resolve_action" : "waiting_for_action", isChallengingBlock ? pending : true);
  };

  const handleBlock = async (character) => {
    setIsProcessing(true);
    await updateDoc(doc(db, "rooms", roomCode), {
      gameState: "waiting_for_block_responses", 
      pendingAction: { ...roomData.pendingAction, blockerId: user.token, blockCharacter: character }, 
      passVotes: [], actionLog: `🛡️ ${myPlayer.name} บล็อกด้วย ${character}!`
    });
  };

  const resolveAction = async (pending) => {
    const sourceRef = doc(db, `rooms/${roomCode}/players`, pending.sourceId);
    if (pending.targetId && players.find(p => p.id === pending.targetId)?.isDead) return passTurn(`เป้าหมายตายแล้ว!`);
    if (pending.actionName === "ForeignAid") { await updateDoc(sourceRef, { coins: increment(2) }); passTurn(`💰 รับ Foreign Aid`); }
    else if (pending.actionName === "Tax") { await updateDoc(sourceRef, { coins: increment(3) }); passTurn(`💰 เก็บภาษีสำเร็จ`); }
    else if (pending.actionName === "Steal") {
      const target = players.find(p => p.id === pending.targetId);
      const stealAmount = target.coins >= 2 ? 2 : target.coins;
      await updateDoc(doc(db, `rooms/${roomCode}/players`, target.id), { coins: increment(-stealAmount) });
      await updateDoc(sourceRef, { coins: increment(stealAmount) });
      passTurn(`🥷 ปล้นสำเร็จ`);
    } else if (pending.actionName === "Assassinate") { triggerDiscard(pending.targetId, `🔪 ลอบสังหารสำเร็จ!`, "waiting_for_action", true); }
    else if (pending.actionName === "Exchange") {
      const deck = [...roomData.deck].sort(() => Math.random() - 0.5);
      const drawn = [ { character: deck.pop(), isDead: false, id: Date.now() }, { character: deck.pop(), isDead: false, id: Date.now()+1 } ];
      await updateDoc(doc(db, "rooms", roomCode), { deck, gameState: "waiting_for_exchange", drawnCards: drawn, actionLog: "🔄 Ambassador กำลังเลือกไพ่..." });
    }
  };

  const submitDiscard = async (cardIndex) => {
    setIsProcessing(true);
    let newCards = [...myPlayer.cards];
    newCards[cardIndex].isDead = true;
    const isDead = newCards.filter(c => !c.isDead).length === 0;
    await updateDoc(doc(db, `rooms/${roomCode}/players`, user.token), { cards: newCards, isDead });
    if (roomData.afterDiscardState === "waiting_for_action") await passTurn(`เหตุการณ์สงบลง`);
    else if (roomData.afterDiscardState === "resolve_action") await resolveAction(roomData.afterDiscardPayload);
  };

  const handleToggleExchangeCard = (idx) => {
    setSelectedAmbassadorCards(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : prev.length < myPlayer.cards.filter(c => !c.isDead).length ? [...prev, idx] : prev);
  };

  const confirmExchange = async () => {
    setIsProcessing(true);
    const alive = myPlayer.cards.filter(c => !c.isDead);
    const pool = [...alive, ...roomData.drawnCards];
    const finalCards = [...pool.filter((_, idx) => selectedAmbassadorCards.includes(idx)), ...myPlayer.cards.filter(c => c.isDead)];
    await updateDoc(doc(db, `rooms/${roomCode}/players`, user.token), { cards: finalCards });
    await updateDoc(doc(db, "rooms", roomCode), { deck: [...roomData.deck, ...pool.filter((_, idx) => !selectedAmbassadorCards.includes(idx)).map(c => c.character)].sort(() => Math.random() - 0.5) });
    setSelectedAmbassadorCards([]); passTurn("🔄 สลับไพ่สำเร็จ");
  };

  const handleAdminReset = async () => { if (window.confirm("ยุติเกมและกลับล็อบบี้?")) await updateDoc(doc(db, "rooms", roomCode), { status: "lobby", gameState: "setup_phase", actionLog: "รอเริ่มเกมใหม่..." }); };
  const handleSurrender = async () => { if(window.confirm("ยอมแพ้?")) { await deleteDoc(doc(db, `rooms/${roomCode}/players`, user.token)); onLeaveGame(); } };

  if (!roomData || !myPlayer) return <div>Loading...</div>;
  if (gameState === "game_over") return <VictoryScreen winnerName={alivePlayers[0]?.name} isAdmin={roomData?.adminId === user.token} onAdminReset={handleAdminReset} />;

  // (โค้ดส่วนบนและการจัดการ State ทั้งหมดใน GameBoard.jsx คงไว้เหมือนเดิมทุกประการ)
// ให้แก้ไขเฉพาะส่วน return ด้านล่างนี้ครับ:

  return (
    <div className="gb-wrapper">
      <header className="gb-header animate-fade-up">
        <h1 className="gb-title">COUP</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div className="gb-badge">🃏 Court Deck: {roomData?.deck?.length || 0}</div>
          <button className="gb-badge" style={{ cursor: 'pointer', background: 'rgba(241,196,15,0.15)', color: '#f1c40f' }} onClick={onShowRules}>📖 กติกา</button>
          {roomData?.adminId === user.token && <button className="gb-badge" style={{ cursor: 'pointer', color: '#fca5a5' }} onClick={handleAdminReset}>🔄 ยุติเกม</button>}
          <button className="gb-badge" style={{ cursor: 'pointer' }} onClick={handleSurrender}>🚪 ออก</button>
        </div>
      </header>

      <div className="gb-layout">
        <div className="gb-left animate-fade-up"><OpponentList players={players} userToken={user.token} roomData={roomData} /></div>
        
        <div className="gb-center">
          <PlayerActionPanel 
            gameState={gameState} isMyTurn={isMyTurn} myPlayer={myPlayer} players={players} roomData={roomData} userToken={user.token} 
            timeLeft={timeLeft} actionToConfirm={actionToConfirm} targetAction={targetAction} isProcessing={isProcessing} 
            selectedAmbassadorCards={selectedAmbassadorCards} performAction={performAction} handleActionClick={handleActionClick} 
            handleTargetSelect={handleTargetSelect} setTargetAction={setTargetAction} setActionToConfirm={setActionToConfirm} 
            handleVotePass={handleVotePass} handleChallenge={handleChallenge} handleBlock={handleBlock} submitDiscard={submitDiscard} 
            handleToggleExchangeCard={handleToggleExchangeCard} confirmExchange={confirmExchange}
          />
        </div>
        
        <div className="gb-right animate-fade-up">
          {/* ลบป้ายประกาศฝั่งขวาออกไป แล้วเหลือแค่ ActionLog ล้วนๆ */}
          <ActionLog historyLog={historyLog} gameState={gameState} alivePlayers={alivePlayers} roomData={roomData} />
        </div>
      </div>
    </div>
  );
}