// components/GameBoard.jsx
import { useState, useEffect } from 'react';
import { doc, collection, onSnapshot, getDocs, updateDoc, writeBatch, increment, arrayUnion, deleteDoc } from "firebase/firestore";
import { db } from '../core/firebase';

// Import ส่วนประกอบย่อย
import VictoryScreen from './VictoryScreen.jsx';
import OpponentList from './OpponentList.jsx';
import ActionLog from './ActionLog.jsx';
import PlayerActionPanel from './PlayerActionPanel.jsx';
import ActionAlert from './ActionAlert.jsx'; 

const actionCharacterMap = { "Tax": "Duke", "Assassinate": "Assassin", "Steal": "Captain", "Exchange": "Ambassador" };

const shuffleArray = (array) => {
  let shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export default function GameBoard({ roomCode, user, onLeaveGame }) {
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
          let currentDeck = shuffleArray([...data.deck]);

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
      alert("ระบบป้องกัน: คุณมีเหรียญ 10 เหรียญขึ้นไป บังคับให้ต้องใช้ Coup เท่านั้นครับ!");
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
    if (["Assassinate", "Coup"].includes(actionName)) {
      setActionToConfirm(actionName);
    } else {
      performAction(actionName);
    }
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
    if (pending.targetId) {
       const currentTarget = players.find(p => p.id === pending.targetId);
       if (currentTarget && currentTarget.isDead) return passTurn(`แอคชั่นยกเลิก เนื่องจากเป้าหมายตายไปแล้ว!`);
    }

    if (pending.actionName === "ForeignAid") { await updateDoc(sourceRef, { coins: increment(2) }); passTurn(`💰 รับ Foreign Aid สำเร็จ`); }
    else if (pending.actionName === "Tax") { await updateDoc(sourceRef, { coins: increment(3) }); passTurn(`💰 เก็บภาษีสำเร็จ`); }
    else if (pending.actionName === "Steal") {
      const target = players.find(p => p.id === pending.targetId);
      const stealAmount = target.coins >= 2 ? 2 : target.coins;
      if(stealAmount > 0) { await updateDoc(doc(db, `rooms/${roomCode}/players`, target.id), { coins: increment(-stealAmount) }); await updateDoc(sourceRef, { coins: increment(stealAmount) }); }
      passTurn(`🥷 ปล้นสำเร็จ (+${stealAmount})`);
    }
    else if (pending.actionName === "Assassinate") { triggerDiscard(pending.targetId, `🔪 ลอบสังหารสำเร็จ!`, "waiting_for_action", true); }
    else if (pending.actionName === "Exchange") {
      let deck = shuffleArray([...roomData.deck]); 
      let drawn = [ { character: deck.pop(), isDead: false, id: Date.now() }, { character: deck.pop(), isDead: false, id: Date.now()+1 } ];
      await updateDoc(doc(db, "rooms", roomCode), { deck, gameState: "waiting_for_exchange", drawnCards: drawn, actionLog: "🔄 Ambassador กำลังเลือกไพ่..." });
    }
  };

  const handleChallenge = async () => {
    setIsProcessing(true);
    const pending = roomData.pendingAction;
    const isChallengingBlock = gameState === "waiting_for_block_responses";
    const targetId = isChallengingBlock ? pending.blockerId : pending.sourceId;
    const claimedChar = isChallengingBlock ? pending.blockCharacter : actionCharacterMap[pending.actionName];
    
    const targetData = players.find(p => p.id === targetId);
    const hasCard = targetData.cards.some(c => !c.isDead && c.character === claimedChar);
    
    if (hasCard) triggerDiscard(user.token, `🚨 ท้าทายพลาด! มี ${claimedChar} จริง!`, isChallengingBlock ? "waiting_for_action" : "resolve_action", isChallengingBlock ? true : pending);
    else triggerDiscard(targetId, `🚨 ท้าทายสำเร็จ! โกหก ไม่มี ${claimedChar}!`, isChallengingBlock ? "resolve_action" : "waiting_for_action", isChallengingBlock ? pending : true);
  };

  const submitDiscard = async (cardIndex) => {
    setIsProcessing(true);
    let newCards = [...myPlayer.cards];
    newCards[cardIndex].isDead = true;
    const isDead = newCards.filter(c => !c.isDead).length === 0;
    await updateDoc(doc(db, `rooms/${roomCode}/players`, user.token), { cards: newCards, isDead });
    
    if (roomData.afterDiscardState === "waiting_for_action") {
       await passTurn(`เหตุการณ์สงบลงแล้ว`);
    } else if (roomData.afterDiscardState === "resolve_action") {
       if (isDead && roomData.afterDiscardPayload?.actionName === "Assassinate") await passTurn("เป้าหมายตายจากการจับโกหกไปแล้ว ยกเลิกลอบสังหาร");
       else await resolveAction(roomData.afterDiscardPayload);
    }
  };

  const handleToggleExchangeCard = (cardIdx) => {
    if (selectedAmbassadorCards.includes(cardIdx)) {
      setSelectedAmbassadorCards(prev => prev.filter(i => i !== cardIdx)); 
    } else {
      const aliveCardsCount = myPlayer.cards.filter(c => !c.isDead).length;
      if (selectedAmbassadorCards.length < aliveCardsCount) setSelectedAmbassadorCards(prev => [...prev, cardIdx]); 
    }
  };

  const confirmExchange = async () => {
    setIsProcessing(true);
    const aliveCardsCount = myPlayer.cards.filter(c => !c.isDead).length;
    if (selectedAmbassadorCards.length !== aliveCardsCount) { setIsProcessing(false); return alert(`คุณต้องเลือกไพ่ ${aliveCardsCount} ใบครับ`); }

    const aliveCards = myPlayer.cards.filter(c => !c.isDead);
    const pool = [...aliveCards, ...roomData.drawnCards];
    
    let newHand = pool.filter((_, idx) => selectedAmbassadorCards.includes(idx));
    let toReturn = pool.filter((_, idx) => !selectedAmbassadorCards.includes(idx)).map(c => c.character);
    let finalCards = [...newHand, ...myPlayer.cards.filter(c => c.isDead)];
    
    let newDeck = shuffleArray([...roomData.deck, ...toReturn]); 
    await updateDoc(doc(db, `rooms/${roomCode}/players`, user.token), { cards: finalCards });
    await updateDoc(doc(db, "rooms", roomCode), { deck: newDeck });
    setSelectedAmbassadorCards([]); 
    passTurn("🔄 สลับไพ่สำเร็จ");
  };

  const handleAdminReset = async () => {
    if (gameState === "game_over" || window.confirm("แน่ใจหรือไม่ที่จะยุติเกมและพาทุกคนกลับไปที่ล็อบบี้?")) {
      await updateDoc(doc(db, "rooms", roomCode), { status: "lobby", gameState: "setup_phase", actionLog: "รอเริ่มเกมใหม่..." });
    }
  };

  const handleSurrender = async () => {
    if(window.confirm("คุณต้องการยอมแพ้และออกจากห้องนี้ไปเลยใช่หรือไม่?")) {
      await deleteDoc(doc(db, `rooms/${roomCode}/players`, user.token));
      localStorage.removeItem('coup_current_room');
      onLeaveGame();
    }
  };

  if (!roomData || !myPlayer) return <div className="game-board-full" style={{justifyContent:'center', alignItems:'center'}}><h2>กำลังโหลดข้อมูลเกม...</h2></div>;
  
  if (gameState === "game_over") {
    return (
      <VictoryScreen 
        winnerName={alivePlayers[0]?.name} 
        isAdmin={roomData?.adminId === user.token} 
        onAdminReset={handleAdminReset} 
      />
    );
  }

  return (
    <div className="game-board-full">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '15px', borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={{ backgroundColor: '#7f8c8d', color: 'white', margin: 0 }} onClick={handleSurrender}>🚪 ยอมแพ้ / ออก</button>
          {roomData?.adminId === user.token && (
            <button className="danger" style={{ margin: 0 }} onClick={handleAdminReset}>🔄 ยุติเกม (Admin)</button>
          )}
        </div>
        <div style={{ color: 'var(--gold)', fontWeight: 'bold', fontSize: '18px' }}>รหัสห้อง: {roomCode}</div>
      </div>

      <div className="game-layout">
        <div className="game-left-panel">
          
          {/* รายชื่อคู่แข่งด้านบน */}
          <OpponentList players={players} userToken={user.token} roomData={roomData} />
          
          {/* 🌟 ย้าย ActionAlert มาไว้ตรงนี้ ระหว่างรายชื่อผู้เล่นและกล่องประวัติ */}
          <ActionAlert 
            gameState={gameState} 
            pendingAction={roomData?.pendingAction} 
            players={players} 
          />
          
          {/* กล่องประวัติการกระทำด้านล่าง */}
          <ActionLog 
            historyLog={historyLog} 
            gameState={gameState} 
            alivePlayers={alivePlayers} 
            roomData={roomData} 
          />

        </div>

        <PlayerActionPanel 
          gameState={gameState}
          isMyTurn={isMyTurn}
          myPlayer={myPlayer}
          players={players}
          roomData={roomData}
          userToken={user.token}
          timeLeft={timeLeft}
          actionToConfirm={actionToConfirm}
          targetAction={targetAction}
          isProcessing={isProcessing}
          selectedAmbassadorCards={selectedAmbassadorCards}
          performAction={performAction}
          handleActionClick={handleActionClick}
          handleTargetSelect={handleTargetSelect}
          setTargetAction={setTargetAction}
          setActionToConfirm={setActionToConfirm}
          handleVotePass={handleVotePass}
          handleChallenge={handleChallenge}
          handleBlock={handleBlock}
          submitDiscard={submitDiscard}
          handleToggleExchangeCard={handleToggleExchangeCard}
          confirmExchange={confirmExchange}
        />
      </div>
    </div>
  );
}