export const COLORS = ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Indigo', 'Violet', 'White', 'Black'] as const;
export type Color = typeof COLORS[number];

export const RAINBOW_COLORS: Color[] = ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Indigo', 'Violet'];

export interface Card {
  id: number;
  frontColor: Color;
  backColor: Color;
}

export interface CenterRowCard extends Card {
  isFaceUp: boolean;
}

export interface Player {
  id: string; // Firebase UID
  name: string;
  hand: Card[];
  discardPile: Card[];
}

export type TurnState = 'PLAYING' | 'ROUND_OVER';
export type RowState = 'VALID' | 'DUPLICATE_COLOR' | 'BLACK_CARD';
export type GamePhase = 'LOBBY' | 'PLAYING' | 'GAME_OVER';
export type RoundEndReason = 'DUPLICATE_COLOR' | 'BLACK_CARD' | 'RAINBOW_COMPLETE' | null;

export interface GameState {
  phase: GamePhase;
  players: Player[]; // Can be 1 or 2 players
  deck: Card[];
  centerRow: CenterRowCard[];
  currentPlayerIndex: 0 | 1;
  turnState: TurnState;
  playedCardsThisTurn: number;
  roundEndReason: RoundEndReason;
  roundWinnerId: string | null;
  gameWinnerId: string | null;
  isTie: boolean;
  lastActionLog: string;
  turnTimer: number;
}

// Firestore Match Document
export interface Match {
    id?: string; // Document ID
    player1Id: string;
    player2Id: string; // Empty if waiting
    status: 'LOBBY' | 'PLAYING' | 'GAME_OVER';
    isPublic: boolean;
    joinCode?: string;
    gameState: GameState | null; // Can be null during setup
    createdAt: any; // Firestore ServerTimestamp
    updatedAt: any; // Firestore ServerTimestamp
}
