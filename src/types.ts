export interface User {
  token: string;
  name: string;
}

export type PlayerAvatarId = 'male' | 'female';

export interface Card {
  character: string;
  isDead: boolean;
}

export interface Player {
  id: string;
  name: string;
  coins: number;
  cards?: Card[];
  influenceCount?: number;
  revealedCards?: { slot: number; character: string }[];
  isAlive: boolean;
  isDead?: boolean;
  isReady?: boolean;
  avatarId?: PlayerAvatarId;
}

export interface GameState {
  status: 'waiting' | 'playing' | 'finished';
  turnIndex: number;
  players: Record<string, Player>;
  deck?: string[];
  deckCount?: number;
  drawnCards?: Card[];
  exchangeOptions?: Card[];
  actionQueue?: any[];
  winner?: string;
  history?: any[];
}

export interface RoomData {
  id?: string;
  name?: string;
  code?: string;
  adminId?: string;
  gameState?: GameState | string;
  players?: Record<string, Player>;
  createdAt?: any;
  status?: string;
  turnOrder?: string[];
  currentTurnIndex?: number;
  deck?: string[];
  actionQueue?: any[];
  winner?: string;
  history?: any[];
}
