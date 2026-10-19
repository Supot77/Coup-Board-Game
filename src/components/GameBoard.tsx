import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
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
import { getResponseSecondsLeft, timestampMillis } from '../core/responseTiming';
import type { PublicGameEvent } from '../core/gameEvents';
import TableOverview from './TableOverview';
import GameFeedback from './GameFeedback';
import LoadingScreen from './LoadingScreen';
import '../styles/gameplay.css';

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
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [events, setEvents] = useState<PublicGameEvent[]>([]);
  const [historyError, setHistoryError] = useState('');
  const [eventsConfirmed, setEventsConfirmed] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [fromCache, setFromCache] = useState(false);
  const [wallNow, setWallNow] = useState(Date.now);
  const [commandStage, setCommandStage] = useState<'sending' | 'received' | null>(null);
  const [queuedAt, setQueuedAt] = useState(0);
  const commandBusy = useRef(false);
  const [historyLog, setHistoryLog] = useState<{ raw: string; text: string }[]>([]);
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
      setFromCache(fromCache === true);
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
    const timer = window.setInterval(() => setWallNow(Date.now()), 1000);
    const updateOnline = () => { setOnline(navigator.onLine); setWallNow(Date.now()); };
    window.addEventListener('online', updateOnline); window.addEventListener('offline', updateOnline);
    return () => { window.clearInterval(timer); window.removeEventListener('online', updateOnline); window.removeEventListener('offline', updateOnline); };
  }, []);

  useEffect(() => {
    setEvents([]); setEventsConfirmed(false); setHistoryError('');
    if (!roomData?.roundId) return;
    const roundId = roomData.roundId;
    return onSnapshot(query(collection(db, `rooms/${roomCode}/events`), where('roundId', '==', roundId)), { includeMetadataChanges: true }, snapshot => {
      setEvents(snapshot.docs.map(event => ({ id: event.id, ...event.data() }) as PublicGameEvent).sort((a, b) => a.sequence - b.sequence));
      setEventsConfirmed(snapshot.metadata?.fromCache !== true && snapshot.metadata?.hasPendingWrites !== true);
      setHistoryError('');
    }, error => setHistoryError(getCallableMessage(error)));
  }, [roomCode, roomData?.roundId]);

  useEffect(() => {
    let active = true;
    const key = `coup_pending_${roomCode}_${user.token}`;
    const commandId = sessionStorage.getItem(key);
    if (!commandId) return;
    commandBusy.current = true; setIsProcessing(true); setCommandStage('received'); setQueuedAt(Date.now());
    void waitForCommandResult(roomCode, commandId, user.token).catch(error => { if (active) notify(getCallableMessage(error)); }).finally(() => {
      sessionStorage.removeItem(key);
      if (active) { commandBusy.current = false; setIsProcessing(false); setCommandStage(null); }
    });
    return () => { active = false; };
  }, [roomCode, user.token, notify]);

  const basePlayer = players.find(player => player.id === user.token);
  const myPlayer = basePlayer ? { ...basePlayer, cards: privateCards } : undefined;
  const displayPlayers = players.map(player => player.id === user.token ? { ...player, cards: privateCards } : player);
  const alivePlayers = players.filter(player => !player.isDead);
  const gameState = roomData?.gameState;
  const isMyTurn = roomData?.turnOrder?.[roomData?.currentTurnIndex] === user.token;
  const timeLeft = roomData ? getResponseSecondsLeft(roomData, wallNow) : null;
  const gameTime = roomData?.gameStartedAt ? Math.max(0, Math.floor(((roomData.gameEndedAt ?? wallNow) - roomData.gameStartedAt) / 1000)) : 0;
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
    if (commandBusy.current) return false;
    commandBusy.current = true; setIsProcessing(true); setCommandStage('sending');
    const key = `coup_pending_${roomCode}_${user.token}`;
    try {
      const contextualCommand = { ...command, ...(roomData?.roundId ? { expectedRoundId: roomData.roundId } : {}),
        ...(roomData?.turnNumber ? { expectedTurnNumber: roomData.turnNumber } : {}) };
      const { commandId } = await submitGameCommand(roomCode, user.token, contextualCommand, db, id => sessionStorage.setItem(key, id));
      sessionStorage.setItem(key, commandId);
      setCommandStage('received'); setQueuedAt(Date.now());
      await waitForCommandResult(roomCode, commandId, user.token);
      return true;
    } catch (error) {
      notify(getCallableMessage(error));
      return false;
    } finally {
      sessionStorage.removeItem(key); commandBusy.current = false; setIsProcessing(false); setCommandStage(null);
    }
  }, [roomCode, user.token, notify, roomData?.roundId, roomData?.turnNumber]);

  const responseCommand = (response: 'pass' | 'challenge' | 'block', character?: string): GameCommand => ({
    type: 'respond', response, ...(character ? { character } : {}),
    ...(roomData?.responseWindowId ? { responseWindowId: roomData.responseWindowId } : {}),
  });
  const handleVotePass = () => runCommand(responseCommand('pass'));
  useEffect(() => { setTargetAction(null); setSelectedTargetId(null); }, [roomData?.roundId, roomData?.turnNumber]);
  useEffect(() => {
    if (!myActionTurn) { setTargetAction(null); setSelectedTargetId(null); }
    if (gameState !== 'waiting_for_exchange') setSelectedAmbassadorCards([]);
  }, [myActionTurn, gameState]);

  const performAction = async (actionName: string) => {
    if (['Assassinate', 'Steal', 'Coup'].includes(actionName)) {
      setSelectedTargetId(null); setTargetAction(actionName); return;
    }
    await runCommand({ type: 'action', actionName });
  };
  const handleActionClick = (actionName: string) => { void performAction(actionName); };
  const handleTargetSelect = (targetId: string | null) => setSelectedTargetId(targetId);
  const confirmTargetAction = async () => {
    if (!targetAction || !selectedTargetId || !myActionTurn || !players.some(player => player.id === selectedTargetId && !player.isDead)) return;
    if (await runCommand({ type: 'action', actionName: targetAction, targetId: selectedTargetId })) {
      setTargetAction(null); setSelectedTargetId(null);
    }
  };
  const handleChallenge = () => runCommand(responseCommand('challenge'));
  const handleBlock = (character: string) => runCommand(responseCommand('block', character));
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
    if (await runCommand({ type: 'surrender' })) {
      localStorage.removeItem('coup_current_room');
      onLeaveGame();
    }
  };

  if (!roomData || !myPlayer) return <LoadingScreen message="กำลังโหลดข้อมูลห้อง" />;
  const roomForUi: RoomData = { ...roomData, drawnCards: undefined, exchangeOptions };
  const canRespond = !myPlayer.isDead && waitingForMe;
  const hostSeenAt = timestampMillis(roomData.hostSeenAt);
  const waitingHost = commandStage === 'received' && wallNow - queuedAt >= 5000;
  const connectionMessage = !online ? 'การเชื่อมต่อขาด · เชื่อมต่ออินเทอร์เน็ตเพื่อดำเนินเกมต่อ'
    : fromCache ? 'กำลังซิงค์ข้อมูลห้อง · ข้อมูลที่เห็นอาจยังไม่ใช่สถานะล่าสุด'
    : commandStage === 'sending' ? 'กำลังส่งคำสั่ง…'
    : waitingHost ? 'รับคำสั่งแล้ว · กำลังรออุปกรณ์เจ้าของห้อง ไม่ต้องกดส่งซ้ำ'
    : commandStage === 'received' ? 'รับคำสั่งแล้ว · กำลังประมวลผล'
    : hostSeenAt !== null && wallNow - hostSeenAt > 45_000 && gameState !== 'game_over' ? 'ยังไม่ได้รับสัญญาณล่าสุดจากเจ้าของห้อง · เกมอาจรอการเชื่อมต่อ' : '';

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
            {roomData.gameStartedAt && (gameState !== 'game_over' || roomData.gameEndedAt) && <span className="game-stat" aria-label={`เวลาเล่น ${formatGameTime(gameTime)}`}><GameIcon kind="clock" /><span className="game-stat-label">เวลาเล่น</span><strong>{formatGameTime(gameTime)}</strong></span>}
            <span className="game-stat" aria-label={`ไพ่กองกลาง ${roomData.deckCount ?? 0} ใบ`}><GameIcon kind="cards" /><span className="game-stat-label">กองกลาง</span><strong>{roomData.deckCount ?? 0}</strong></span>
          </div>
        </div>
        <nav className="game-header-controls" aria-label="จัดการเกม">
          <GameFeedback events={events} roundId={roomData.roundId} live={online && !fromCache && eventsConfirmed} myTurn={myActionTurn} />
          <button aria-label="เปิดกติกา" className="game-rules-button" onClick={onShowRules}><GameIcon kind="book" /><span>กติกา</span></button>
          {roomData.adminId === user.token && <button aria-label="ยุติเกม" disabled={isProcessing} onClick={handleAdminReset}><GameIcon kind="reset" /><span>ยุติเกม</span></button>}
          <button aria-label="ออกจากเกม" disabled={isProcessing} onClick={handleSurrender}><GameIcon kind="exit" /><span>ออก</span></button>
        </nav>
      </header>

      <TableOverview players={players} room={roomForUi} viewerUid={user.token} />
      <nav className="mobile-tabs" aria-label="เมนูเกม">
        {[
          ['board', 'ไพ่ของฉัน', false],
          ['actions', 'แอคชั่น', canRespond || (!myPlayer.isDead && (isMyTurn && gameState === 'waiting_for_action' || gameState === 'waiting_for_discard' && roomData.discardTarget === user.token || gameState === 'waiting_for_exchange' && isMyTurn))],
          ['players', 'ผู้เล่น', false], ['log', 'ประวัติ', false],
        ].map(([id, label, available]) => <button key={String(id)} type="button" aria-current={activeMobileTab === id ? 'page' : undefined} onClick={() => setActiveMobileTab(String(id))}>
          {label}{available && <span className="action-ready">พร้อม</span>}
        </button>)}
      </nav>
      {connectionMessage && <div className="connection-status" role="status" data-offline={!online}>
        <span className="connection-dot" aria-hidden="true" />{connectionMessage}
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
            timeLeft={responding ? timeLeft : null} selectedTargetId={selectedTargetId} confirmTargetAction={confirmTargetAction} targetAction={targetAction} isProcessing={isProcessing}
            selectedAmbassadorCards={selectedAmbassadorCards} performAction={performAction} handleActionClick={handleActionClick}
            handleTargetSelect={handleTargetSelect} setTargetAction={setTargetAction}
            handleVotePass={handleVotePass} handleChallenge={handleChallenge} handleBlock={handleBlock} submitDiscard={submitDiscard}
            handleToggleExchangeCard={handleToggleExchangeCard} confirmExchange={confirmExchange}
            gameTime={gameTime} showActionsOnly={activeMobileTab === 'actions'}
          />
        </div>
        <div className={`game-column game-column-log desktop-column ${activeMobileTab === 'log' ? 'mobile-visible' : ''}`}>
          <ActionLog historyLog={historyLog} events={events} players={players} error={historyError} gameState={gameState} alivePlayers={alivePlayers} roomData={roomForUi} />
        </div>
      </div>
      {gameState === 'game_over' && victoryOpen && <VictoryScreen events={events} room={roomData} winnerName={alivePlayers[0]?.name} isAdmin={roomData.adminId === user.token} onAdminReset={handleAdminReset} onClose={() => setVictoryOpen(false)} />}
    </div>
  );
}
