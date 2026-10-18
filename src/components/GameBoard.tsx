import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../core/firebase';
import { useDialog } from './DialogProvider';
import { useSession } from './SessionProvider';
import { getCallableMessage, resetGame } from '../core/roomCommands';
import { submitGameCommand, waitForCommandResult, type GameCommand } from '../core/gameCommands';
import { watchHostCommands } from '../core/hostCommandProcessor';
import type { Card, Player, RoomData, User } from '../types';
import VictoryScreen from './VictoryScreen.jsx';
import OpponentList from './OpponentList.jsx';
import ActionLog from './ActionLog.jsx';
import PlayerActionPanel from './PlayerActionPanel.jsx';
import GameIcon from './GameIcon';
import { isRoomAccessLost, ROOM_UNAVAILABLE_MESSAGE } from '../core/roomAccess';
import { getResponseTimeoutSeconds } from '../core/responseTiming';
import LoadingScreen from './LoadingScreen';

const formatGameTime = (totalSeconds: number) => {
  const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const secs = String(totalSeconds % 60).padStart(2, '0');
  return `${mins}:${secs}`;
};

export default function GameBoard({ roomCode, user, onLeaveGame, onShowRules, opening = false, onOpeningCards }: {
  roomCode: string; user: User; onLeaveGame: () => void; onShowRules: () => void;
  opening?: boolean; onOpeningCards?: (roles: string[] | null) => void;
}) {
  const { notify, confirm } = useDialog();
  const { setIdleExempt } = useSession();
  const [roomData, setRoomData] = useState<any>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [privateCards, setPrivateCards] = useState<Card[]>([]);
  const [privateHandConfirmed, setPrivateHandConfirmed] = useState(false);
  const [exchangeOptions, setExchangeOptions] = useState<Card[]>([]);
  const [targetAction, setTargetAction] = useState<string | null>(null);
  const [selectedAmbassadorCards, setSelectedAmbassadorCards] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [actionToConfirm, setActionToConfirm] = useState<string | null>(null);
  const [historyLog, setHistoryLog] = useState<{ raw: string; text: string }[]>([]);
  const [gameTime, setGameTime] = useState(0);
  const [activeMobileTab, setActiveMobileTab] = useState('board');
  const [victoryOpen, setVictoryOpen] = useState(true);
  const [turnNoticeOpen, setTurnNoticeOpen] = useState(false);
  const wasMyActionTurn = useRef(false);
  const invalidatedRoom = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    const forgetRoom = () => {
      if (!active || invalidatedRoom.current === roomCode) return;
      invalidatedRoom.current = roomCode;
      active = false;
      localStorage.removeItem('coup_current_room');
      notify(ROOM_UNAVAILABLE_MESSAGE);
      onLeaveGame();
    };
    const handleSnapshotError = (error: unknown) => {
      if (!active) return;
      if (isRoomAccessLost(error)) forgetRoom();
      else notify(getCallableMessage(error));
    };
    const roomRef = doc(db, 'rooms', roomCode);
    const playersRef = collection(db, `rooms/${roomCode}/players`);
    const privateRef = doc(db, `rooms/${roomCode}/privatePlayers/${user.token}`);
    const unsubRoom = onSnapshot(roomRef, { includeMetadataChanges: true }, snapshot => {
      if (!active) return;
      const fromCache = snapshot.metadata?.fromCache;
      if (!snapshot.exists()) {
        if (fromCache) return;
        forgetRoom();
        return;
      }
      const data = snapshot.data();
      setRoomData(data);
      if (data.gameState !== 'game_over') setVictoryOpen(true);
      if (data.status === 'lobby') { active = false; onLeaveGame(); return; }
      if (data.actionLog) {
        setHistoryLog(previous => {
          if (previous[previous.length - 1]?.raw === data.actionLog) return previous;
          const elapsed = data.gameStartedAt ? Math.max(0, Math.floor((Date.now() - data.gameStartedAt) / 1000)) : 0;
          return [...previous, { raw: data.actionLog, text: `[${formatGameTime(elapsed)}] ${data.actionLog}` }];
        });
      }
    }, handleSnapshotError);
    const unsubPlayers = onSnapshot(playersRef, snapshot => {
      if (!active) return;
      setPlayers(snapshot.docs.map(player => ({ id: player.id, ...player.data() }) as Player));
    }, handleSnapshotError);
    const unsubPrivate = onSnapshot(privateRef, { includeMetadataChanges: true }, snapshot => {
      if (!active) return;
      const data = snapshot.data();
      setPrivateHandConfirmed(snapshot.exists() && snapshot.metadata?.fromCache !== true);
      setPrivateCards((data?.cards ?? []) as Card[]);
      setExchangeOptions((data?.exchangeOptions ?? []) as Card[]);
    }, handleSnapshotError);
    return () => { active = false; unsubRoom(); unsubPlayers(); unsubPrivate(); };
  }, [roomCode, user.token, notify, onLeaveGame]);

  useEffect(() => {
    if (roomData?.status !== 'playing' || roomData?.adminId !== user.token) return;
    return watchHostCommands(roomCode, user.token, error => notify(getCallableMessage(error)));
  }, [roomCode, roomData?.status, roomData?.adminId, user.token, notify]);

  useEffect(() => {
    if (!roomData?.gameStartedAt || roomData?.gameState === 'game_over') {
      setGameTime(0);
      return;
    }
    const tick = () => setGameTime(Math.max(0, Math.floor((Date.now() - roomData.gameStartedAt) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [roomData?.gameStartedAt, roomData?.gameState]);

  const basePlayer = players.find(player => player.id === user.token);
  const myPlayer = basePlayer ? { ...basePlayer, cards: privateCards } : undefined;
  const displayPlayers = players.map(player => player.id === user.token ? { ...player, cards: privateCards } : player);
  const alivePlayers = players.filter(player => !player.isDead);
  const gameState = roomData?.gameState;
  const isMyTurn = roomData?.turnOrder?.[roomData?.currentTurnIndex] === user.token;
  const responseTimeoutSeconds = getResponseTimeoutSeconds(roomData?.responseTimeoutSeconds);
  const myActionTurn = isMyTurn && gameState === 'waiting_for_action' && !!basePlayer && !basePlayer.isDead;
  const responding = gameState === 'waiting_for_responses' || gameState === 'waiting_for_block_responses';
  const myResponsePassed = roomData?.passVotes?.includes(user.token);
  const waitingForMe = !basePlayer?.isDead && responding && !myResponsePassed
    && !(gameState === 'waiting_for_responses' && roomData?.pendingAction?.sourceId === user.token)
    && !(gameState === 'waiting_for_block_responses' && roomData?.pendingAction?.blockerId === user.token);

  useEffect(() => {
    if (!opening || !roomData) return;
    // Any progress beyond the opening turn takes priority over presentation.
    if (roomData.status !== 'playing' || gameState !== 'waiting_for_action' || roomData.currentTurnIndex !== 0 || basePlayer?.isDead) {
      onOpeningCards?.(null);
    } else if (privateHandConfirmed && privateCards.length === 2) {
      onOpeningCards?.(privateCards.map(card => card.character));
    }
  }, [opening, roomData, gameState, basePlayer?.isDead, privateCards, privateHandConfirmed, onOpeningCards]);

  useEffect(() => {
    if (!roomData || !basePlayer) { setIdleExempt(false); return; }
    let exempt = false;
    if (gameState === 'waiting_for_action' || gameState === 'waiting_for_exchange') exempt = !isMyTurn;
    else if (gameState === 'waiting_for_discard') exempt = roomData.discardTarget !== user.token;
    else if (responding) exempt = !!basePlayer.isDead || !waitingForMe;
    setIdleExempt(exempt);
  }, [roomData, basePlayer, gameState, isMyTurn, responding, waitingForMe, user.token, setIdleExempt]);

  useEffect(() => {
    if (opening) { setTurnNoticeOpen(false); wasMyActionTurn.current = false; return; }
    if (myActionTurn && !wasMyActionTurn.current) setTurnNoticeOpen(true);
    if (!myActionTurn) setTurnNoticeOpen(false);
    wasMyActionTurn.current = myActionTurn;
  }, [myActionTurn, opening]);

  useEffect(() => {
    if (!turnNoticeOpen) return;
    const timer = window.setTimeout(() => setTurnNoticeOpen(false), 6000);
    return () => window.clearTimeout(timer);
  }, [turnNoticeOpen]);

  const runCommand = useCallback(async (command: GameCommand): Promise<boolean> => {
    setIsProcessing(true);
    try {
      const { commandId } = await submitGameCommand(roomCode, user.token, command);
      await waitForCommandResult(roomCode, commandId, user.token);
      return true;
    } catch (error) {
      notify(getCallableMessage(error));
      return false;
    } finally { setIsProcessing(false); }
  }, [roomCode, user.token, notify]);

  const handleVotePass = useCallback(() => runCommand({ type: 'respond', response: 'pass' }), [runCommand]);

  useEffect(() => {
    if (!waitingForMe || isProcessing) { setTimeLeft(null); return; }
    setTimeLeft(responseTimeoutSeconds);
    const deadline = Date.now() + responseTimeoutSeconds * 1000;
    let submitted = false;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0 && !submitted) {
        submitted = true;
        window.clearInterval(timer);
        void handleVotePass();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [waitingForMe, gameState, roomData?.pendingAction?.blockerId, responseTimeoutSeconds, isProcessing, handleVotePass]);

  const performAction = async (actionName: string) => {
    if (['Assassinate', 'Steal', 'Coup'].includes(actionName)) {
      setTargetAction(actionName);
      return;
    }
    await runCommand({ type: 'action', actionName });
  };
  const handleActionClick = (actionName: string) => {
    if (['Assassinate', 'Coup'].includes(actionName)) setActionToConfirm(actionName);
    else void performAction(actionName);
  };
  const handleTargetSelect = async (targetId: string) => {
    if (!targetAction) return;
    const actionName = targetAction;
    setTargetAction(null);
    await runCommand({ type: 'action', actionName, targetId });
  };
  const handleChallenge = () => runCommand({ type: 'respond', response: 'challenge' });
  const handleBlock = (character: string) => runCommand({ type: 'respond', response: 'block', character });
  const submitDiscard = (cardIndex: number) => runCommand({ type: 'discard', cardIndex });
  const handleToggleExchangeCard = (index: number) => {
    const required = privateCards.filter(card => !card.isDead).length;
    setSelectedAmbassadorCards(previous => previous.includes(index)
      ? previous.filter(item => item !== index)
      : previous.length < required ? [...previous, index] : previous);
  };
  const confirmExchange = async () => {
    if (await runCommand({ type: 'exchange', cardIndexes: selectedAmbassadorCards })) setSelectedAmbassadorCards([]);
  };

  const handleAdminReset = async () => {
    setVictoryOpen(false);
    if (await confirm('ต้องการจบเกมนี้และกลับล็อบบี้หรือไม่?')) {
      setIsProcessing(true);
      try { await resetGame(roomCode, user.token); }
      catch (error) { notify(getCallableMessage(error)); setIsProcessing(false); }
    } else if (gameState === 'game_over') setVictoryOpen(true);
  };
  const handleSurrender = async () => {
    if (!await confirm('ต้องการยอมแพ้และออกจากเกมหรือไม่?')) return;
    setIsProcessing(true);
    try {
      const { commandId } = await submitGameCommand(roomCode, user.token, { type: 'surrender' });
      await waitForCommandResult(roomCode, commandId, user.token);
      localStorage.removeItem('coup_current_room');
      onLeaveGame();
    } catch (error) { notify(getCallableMessage(error)); setIsProcessing(false); }
    finally { setIsProcessing(false); }
  };

  if (!roomData || !myPlayer) return <LoadingScreen message="กำลังโหลดข้อมูลห้อง" />;
  const roomForUi: RoomData = { ...roomData, drawnCards: undefined, exchangeOptions };
  const canRespond = !myPlayer.isDead && waitingForMe;

  return (
    <div className="gameboard-bg game-shell">
      {turnNoticeOpen && myActionTurn && <aside className="turn-notice" role="status" aria-live="polite">
        <GameIcon kind="clock" />
        <div><strong>ถึงตาคุณแล้ว</strong><span>เลือกแอคชั่นเพื่อดำเนินเกมต่อ</span></div>
        <button className="button-secondary" onClick={() => { setActiveMobileTab('actions'); setTurnNoticeOpen(false); }}>เลือกแอคชั่น</button>
        <button className="turn-notice-close" aria-label="ปิดแจ้งเตือนถึงตาคุณ" onClick={() => setTurnNoticeOpen(false)}>×</button>
      </aside>}

      <header className="game-header">
        <div className="game-brand"><h1>COUP</h1><span>THE SECRET COUNCIL</span></div>
        <div className="game-header-info">
          <div className="game-room-label"><span>ห้อง</span><strong>{roomCode}</strong></div>
          <div className="game-header-stats">
            {roomData.gameStartedAt && <span className="game-stat" aria-label={`เวลาเล่น ${formatGameTime(gameTime)}`}><GameIcon kind="clock" /><span className="game-stat-label">เวลาเล่น</span><strong>{formatGameTime(gameTime)}</strong></span>}
            <span className="game-stat" aria-label={`ไพ่กองกลาง ${roomData.deckCount ?? 0} ใบ`}><GameIcon kind="cards" /><span className="game-stat-label">กองกลาง</span><strong>{roomData.deckCount ?? 0}</strong></span>
          </div>
        </div>
        <nav className="game-header-controls" aria-label="จัดการเกม">
          <button aria-label="เปิดกติกา" className="game-rules-button" onClick={onShowRules}><GameIcon kind="book" /><span>กติกา</span></button>
          {roomData.adminId === user.token && <button aria-label="ยุติเกม" disabled={isProcessing} onClick={handleAdminReset}><GameIcon kind="reset" /><span>ยุติเกม</span></button>}
          <button aria-label="ออกจากเกม" disabled={isProcessing} onClick={handleSurrender}><GameIcon kind="exit" /><span>ออก</span></button>
        </nav>
      </header>

      <nav className="mobile-tabs" aria-label="เมนูเกม">
        {[
          ['board', 'ไพ่ของฉัน', false],
          ['actions', 'แอคชั่น', canRespond || (!myPlayer.isDead && (isMyTurn && gameState === 'waiting_for_action' || gameState === 'waiting_for_discard' && roomData.discardTarget === user.token || gameState === 'waiting_for_exchange' && isMyTurn))],
          ['players', 'ผู้เล่น', false], ['log', 'ประวัติ', false],
        ].map(([id, label, available]) => <button key={String(id)} type="button" aria-current={activeMobileTab === id ? 'page' : undefined} onClick={() => setActiveMobileTab(String(id))}>
          {label}{available && <span className="action-ready">พร้อม</span>}
        </button>)}
      </nav>
      {isProcessing && roomData.adminId !== user.token && <div className="event-banner mx-3 mt-2" role="status">
        คำสั่งกำลังรอเจ้าของห้องออนไลน์เพื่อดำเนินการ
      </div>}
      {gameState === 'game_over' && <div className="event-banner mx-3 mt-2">
        <span>จบเกม · ผู้ชนะ {alivePlayers[0]?.name}</span>
        <button className="utility-button" onClick={() => setVictoryOpen(true)}>ดูผลเกม</button>
      </div>}
      <div className="game-workspace">
        <div className={`game-column game-column-players desktop-column ${activeMobileTab === 'players' ? 'mobile-visible' : ''}`}>
          <OpponentList players={displayPlayers} userToken={user.token} roomData={roomForUi} />
        </div>
        <div className={`game-column game-column-main ${['board', 'actions'].includes(activeMobileTab) ? 'mobile-visible' : ''}`}>
          <PlayerActionPanel
            gameState={gameState} isMyTurn={isMyTurn} myPlayer={myPlayer} players={players} roomData={roomForUi} userToken={user.token}
            timeLeft={timeLeft} actionToConfirm={actionToConfirm} targetAction={targetAction} isProcessing={isProcessing}
            selectedAmbassadorCards={selectedAmbassadorCards} performAction={performAction} handleActionClick={handleActionClick}
            handleTargetSelect={handleTargetSelect} setTargetAction={setTargetAction} setActionToConfirm={setActionToConfirm}
            handleVotePass={handleVotePass} handleChallenge={handleChallenge} handleBlock={handleBlock} submitDiscard={submitDiscard}
            handleToggleExchangeCard={handleToggleExchangeCard} confirmExchange={confirmExchange}
            gameTime={gameTime} showActionsOnly={activeMobileTab === 'actions'}
          />
        </div>
        <div className={`game-column game-column-log desktop-column ${activeMobileTab === 'log' ? 'mobile-visible' : ''}`}>
          <ActionLog historyLog={historyLog} gameState={gameState} alivePlayers={alivePlayers} roomData={roomForUi} />
        </div>
      </div>
      {gameState === 'game_over' && victoryOpen && <VictoryScreen winnerName={alivePlayers[0]?.name} isAdmin={roomData.adminId === user.token} onAdminReset={handleAdminReset} onClose={() => setVictoryOpen(false)} />}
    </div>
  );
}
