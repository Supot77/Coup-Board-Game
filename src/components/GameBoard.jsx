import { useState, useEffect } from 'react';
import { doc, collection, onSnapshot, getDocs, getDoc, updateDoc, writeBatch, increment, arrayUnion, deleteDoc } from "firebase/firestore";
import { db } from '../core/firebase';

// Import ส่วนประกอบย่อย
import VictoryScreen from './VictoryScreen.jsx';
import OpponentList from './OpponentList.jsx';
import ActionLog from './ActionLog.jsx';
import PlayerActionPanel from './PlayerActionPanel.jsx';

const formatGameTime = (totalSeconds) => {
  const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const secs = String(totalSeconds % 60).padStart(2, '0');
  return `${mins}:${secs}`;
};

export default function GameBoard({ roomCode, user, onLeaveGame, onShowRules }) {
  const [roomData, setRoomData] = useState(null);
  const [players, setPlayers] = useState([]);
  const [targetAction, setTargetAction] = useState(null);
  const [selectedAmbassadorCards, setSelectedAmbassadorCards] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [actionToConfirm, setActionToConfirm] = useState(null);
  const [historyLog, setHistoryLog] = useState([]);
  const [gameTime, setGameTime] = useState(0);

  useEffect(() => {
    if (!roomData?.gameStartedAt || roomData?.gameState === "game_over") {
      setGameTime(0);
      return;
    }

    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - roomData.gameStartedAt) / 1000);
      setGameTime(elapsed >= 0 ? elapsed : 0);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [roomData?.gameStartedAt, roomData?.gameState]);

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
              const elapsedSeconds = data.gameStartedAt
                ? Math.floor((Date.now() - data.gameStartedAt) / 1000)
                : 0;
              const mins = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
              const secs = String(elapsedSeconds % 60).padStart(2, '0');
              const timeString = `${mins}:${secs}`;
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
          batch.update(roomRef, { 
            deck: currentDeck, 
            turnOrder: turnOrder.sort(() => Math.random() - 0.5), 
            currentTurnIndex: 0, 
            gameState: "waiting_for_action", 
            actionLog: "🔥 เริ่มเกมได้! ขอให้โชคดี!",
            gameStartedAt: Date.now()
          });
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
      !myPlayer?.isDead &&
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
  }, [gameState, roomData?.passVotes, user.token, myPlayer?.isDead]);

  useEffect(() => {
    if ((gameState === "waiting_for_responses" && roomData?.pendingAction?.sourceId === user.token) || 
        (gameState === "waiting_for_block_responses" && roomData?.pendingAction?.blockerId === user.token)) {
      if (roomData.passVotes?.length >= alivePlayers.length - 1) {
        if (gameState === "waiting_for_responses") resolveAction(roomData.pendingAction);
        else passTurn(`ทุกคนยอมรับการบล็อก Action ถูกยกเลิก`);
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
      alert("มี 10 เหรียญแล้ว บังคับใช้ Coup เท่านั้น!");
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

  // --- [แก้ไขข้อ 1] จัดการการ Challenge และสลับไพ่ ---
  const handleChallenge = async () => {
    setIsProcessing(true);
    const pending = roomData.pendingAction;
    const actionCharacterMap = { "Tax": "Duke", "Assassinate": "Assassin", "Steal": "Captain", "Exchange": "Ambassador" };
    const isChallengingBlock = gameState === "waiting_for_block_responses";
    
    const targetId = isChallengingBlock ? pending.blockerId : pending.sourceId;
    const claimedChar = isChallengingBlock ? pending.blockCharacter : actionCharacterMap[pending.actionName];
    const targetData = players.find(p => p.id === targetId);
    
    const revealedCardIndex = targetData.cards.findIndex(c => !c.isDead && c.character === claimedChar);
    const hasCard = revealedCardIndex !== -1;

    if (hasCard) {
      // มีการ์ดจริงๆ -> สับการ์ดเดิมเข้ากอง และสุ่มจั่วใบใหม่มาแทนที่
      let currentDeck = [...roomData.deck];
      currentDeck.sort(() => Math.random() - 0.5); // สับก่อนจั่ว
      const newCardChar = currentDeck.pop(); 
      currentDeck.push(claimedChar); // เอาใบที่โชว์ไปใส่คืน
      currentDeck.sort(() => Math.random() - 0.5); // สับอีกรอบให้เนียน

      let newTargetCards = [...targetData.cards];
      newTargetCards[revealedCardIndex] = { character: newCardChar, isDead: false, id: Date.now() };

      const batch = writeBatch(db);
      batch.update(doc(db, `rooms/${roomCode}/players`, targetId), { cards: newTargetCards });
      batch.update(doc(db, "rooms", roomCode), { deck: currentDeck });
      await batch.commit();

      // บังคับคนท้าพลาดทิ้งไพ่
      triggerDiscard(user.token, `🚨 ท้าพลาด! ${targetData.name} มี ${claimedChar} จริง! (ทำการสลับไพ่ใหม่แล้ว)`, isChallengingBlock ? "waiting_for_action" : "resolve_action", isChallengingBlock ? true : pending);
    } else {
      // ไม่มีหน้าไพ่จริงๆ โกหก -> บังคับคนโกหกทิ้งไพ่
      triggerDiscard(targetId, `🚨 ท้าสำเร็จ! โกหก ไม่มี ${claimedChar}!`, isChallengingBlock ? "resolve_action" : "waiting_for_action", isChallengingBlock ? pending : true);
    }
  };

  const handleBlock = async (character) => {
    setIsProcessing(true);
    await updateDoc(doc(db, "rooms", roomCode), {
      gameState: "waiting_for_block_responses", 
      pendingAction: { ...roomData.pendingAction, blockerId: user.token, blockCharacter: character }, 
      passVotes: [], actionLog: `🛡️ ${myPlayer.name} บล็อกด้วย ${character}!`
    });
  };

  // --- [แก้ไขข้อ 3] เช็คสถานะการตายก่อน Resolve ป้องกันตายซ้อนตาย ---
  const resolveAction = async (pending) => {
    const sourceRef = doc(db, `rooms/${roomCode}/players`, pending.sourceId);

    // เช็คข้อมูลสดจาก DB ว่าเป้าหมายเสียชีวิตไปในขั้นตอนก่อนหน้า (เช่น ตอนชาเลนจ์) หรือยัง
    if (pending.targetId) {
      const targetSnap = await getDoc(doc(db, `rooms/${roomCode}/players`, pending.targetId));
      if (targetSnap.exists() && targetSnap.data().isDead) {
         return passTurn(`เป้าหมายเสียชีวิตและพ้นจากเกมไปแล้ว!`);
      }
    }

    if (pending.actionName === "ForeignAid") { await updateDoc(sourceRef, { coins: increment(2) }); passTurn(`💰 รับ Foreign Aid`); }
    else if (pending.actionName === "Tax") { await updateDoc(sourceRef, { coins: increment(3) }); passTurn(`💰 เก็บภาษีสำเร็จ`); }
    else if (pending.actionName === "Steal") {
      const targetSnap = await getDoc(doc(db, `rooms/${roomCode}/players`, pending.targetId));
      const targetCoins = targetSnap.exists() ? targetSnap.data().coins : 0;
      const stealAmount = targetCoins >= 2 ? 2 : targetCoins;
      if (stealAmount > 0) {
        await updateDoc(doc(db, `rooms/${roomCode}/players`, pending.targetId), { coins: increment(-stealAmount) });
        await updateDoc(sourceRef, { coins: increment(stealAmount) });
      }
      passTurn(`🥷 ปล้นสำเร็จ ได้มา ${stealAmount} 💰`);
    } else if (pending.actionName === "Assassinate") {
      triggerDiscard(pending.targetId, `🔪 ลอบสังหารสำเร็จ!`, "waiting_for_action", true);
    }
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
    
    if (roomData.afterDiscardState === "waiting_for_action") {
      await passTurn(`เหตุการณ์สงบลง`);
    } else if (roomData.afterDiscardState === "resolve_action") {
      await resolveAction(roomData.afterDiscardPayload);
    }
  };

  const handleToggleExchangeCard = (idx) => {
    setSelectedAmbassadorCards(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : prev.length < myPlayer.cards.filter(c => !c.isDead).length ? [...prev, idx] : prev);
  };

  // --- [แก้ไขข้อ 2] รีเซ็ตการ์ดลงกองทันทีที่ Ambassador เปลี่ยนไพ่เสร็จ ---
  const confirmExchange = async () => {
    setIsProcessing(true);
    const alive = myPlayer.cards.filter(c => !c.isDead);
    const pool = [...alive, ...roomData.drawnCards];
    const finalCards = [...pool.filter((_, idx) => selectedAmbassadorCards.includes(idx)), ...myPlayer.cards.filter(c => c.isDead)];
    
    // คัดแยกไพ่ที่ไม่ถูกเลือก กลับเข้าใต้กองและสับ
    const unselectedCards = pool.filter((_, idx) => !selectedAmbassadorCards.includes(idx)).map(c => c.character);
    const newDeck = [...roomData.deck, ...unselectedCards].sort(() => Math.random() - 0.5);

    const batch = writeBatch(db);
    batch.update(doc(db, `rooms/${roomCode}/players`, user.token), { cards: finalCards });
    // ตั้งค่า drawnCards เป็น [] ทันทีเพื่อล้างไพ่ออกจากระบบหน้าจอ UI
    batch.update(doc(db, "rooms", roomCode), { deck: newDeck, drawnCards: [] });
    await batch.commit();

    setSelectedAmbassadorCards([]);
    passTurn("🔄 สลับไพ่สำเร็จ");
  };

  const handleAdminReset = async () => { if (window.confirm("ยุติเกมและกลับล็อบบี้?")) await updateDoc(doc(db, "rooms", roomCode), { status: "lobby", gameState: "setup_phase", actionLog: "รอเริ่มเกมใหม่..." }); };
  const handleSurrender = async () => { if(window.confirm("ยอมแพ้?")) { await deleteDoc(doc(db, `rooms/${roomCode}/players`, user.token)); onLeaveGame(); } };

  if (!roomData || !myPlayer) return <div>Loading...</div>;
  if (gameState === "game_over") return <VictoryScreen winnerName={alivePlayers[0]?.name} isAdmin={roomData?.adminId === user.token} onAdminReset={handleAdminReset} />;

  return (
    <div className="gameboard-bg font-outfit text-[#e2e0e8] h-screen w-screen flex flex-col overflow-hidden fixed top-0 left-0">
      <header className="h-[70px] flex items-center justify-between px-6 shrink-0 animate-fade-up">
        <h1 className="font-cinzel text-dark-gold text-2xl font-bold tracking-[2px] m-0">COUP</h1>
        <div className="flex gap-[10px] items-center">
          {roomData?.gameStartedAt && (
            <div className="bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] text-dark-gold py-2 px-4 rounded-full text-[13px] font-medium flex items-center gap-2 transition-all duration-200">
              ⏱️ เวลาเล่น: {formatGameTime(gameTime)}
            </div>
          )}
          <div className="bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] text-dark-gold py-2 px-4 rounded-full text-[13px] font-medium flex items-center gap-2 transition-all duration-200">🃏 Court Deck: {roomData?.deck?.length || 0}</div>
          <button className="bg-[rgba(241,196,15,0.15)] border border-[rgba(212,175,55,0.2)] text-[#f1c40f] py-2 px-4 rounded-full text-[13px] font-medium flex items-center gap-2 transition-all duration-200 cursor-pointer" onClick={onShowRules}>📖 กติกา</button>
          {roomData?.adminId === user.token && <button className="bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] text-[#fca5a5] py-2 px-4 rounded-full text-[13px] font-medium flex items-center gap-2 transition-all duration-200 cursor-pointer" onClick={handleAdminReset}>🔄 ยุติเกม</button>}
          <button className="bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] text-dark-gold py-2 px-4 rounded-full text-[13px] font-medium flex items-center gap-2 transition-all duration-200 cursor-pointer" onClick={handleSurrender}>🚪 ออก</button>
        </div>
      </header>

      <div className="flex gap-5 px-6 pb-5 h-[calc(100vh-70px)] box-border">
        <div className="w-[260px] shrink-0 animate-fade-up"><OpponentList players={players} userToken={user.token} roomData={roomData} /></div>
        
        <div className="flex-1 flex flex-col gap-[15px] h-full">
          <PlayerActionPanel 
            gameState={gameState} isMyTurn={isMyTurn} myPlayer={myPlayer} players={players} roomData={roomData} userToken={user.token} 
            timeLeft={timeLeft} actionToConfirm={actionToConfirm} targetAction={targetAction} isProcessing={isProcessing} 
            selectedAmbassadorCards={selectedAmbassadorCards} performAction={performAction} handleActionClick={handleActionClick} 
            handleTargetSelect={handleTargetSelect} setTargetAction={setTargetAction} setActionToConfirm={setActionToConfirm} 
            handleVotePass={handleVotePass} handleChallenge={handleChallenge} handleBlock={handleBlock} submitDiscard={submitDiscard} 
            handleToggleExchangeCard={handleToggleExchangeCard} confirmExchange={confirmExchange}
            gameTime={gameTime}
          />
        </div>
        
        <div className="w-[280px] shrink-0 animate-fade-up">
          <ActionLog historyLog={historyLog} gameState={gameState} alivePlayers={alivePlayers} roomData={roomData} />
        </div>
      </div>
    </div>
  );
}