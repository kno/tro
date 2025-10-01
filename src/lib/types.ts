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
  id: number;
  name: string;
  hand: Card[];
  discardPile: Card[];
}

export type TurnState = 'PLAYING';
export type RowState = 'VALID' | 'DUPLICATE_COLOR' | 'BLACK_CARD';
export type GamePhase = 'LOBBY' | 'PLAYING' | 'GAME_OVER';
export type RoundEndReason = 'DUPLICATE_COLOR' | 'BLACK_CARD' | 'RAINBOW_COMPLETE' | null;

export interface GameState {
  phase: GamePhase;
  players: [Player, Player];
  deck: Card[];
  centerRow: CenterRowCard[];
  currentPlayerIndex: 0 | 1;
  turnState: TurnState;
  canFlipInitially: boolean;
  playedCardsThisTurn: number;
  roundEndReason: RoundEndReason;
  roundWinner: Player | null;
  roundLoser: Player | null;
  gameWinner: Player | null;
  isTie: boolean;
  lastActionLog: string;
  turnTimer: number;
}
