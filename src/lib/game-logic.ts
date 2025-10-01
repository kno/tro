'use client';
import type { GameState, Player, Card, Color, CenterRowCard, TurnState, RowState } from './types';
import { COLORS, RAINBOW_COLORS } from './types';
import { useReducer, useEffect, useState } from 'react';

// --- CONSTANTS ---
const HAND_SIZE = 3;
const RAINBOW_SIZE = 6;
const TURN_TIME_SECONDS = 60;

// --- DECK CREATION ---
export function createDeck(): Card[] {
  const colorCounts: Record<Color, number> = {
    Red: 6, Orange: 6, Yellow: 6, Green: 6, Blue: 6, Indigo: 6, Violet: 6,
    White: 8, Black: 6,
  };

  const colors: Color[] = [];
  for (const color of COLORS) {
    for (let i = 0; i < colorCounts[color]; i++) {
      colors.push(color);
    }
  }

  const frontColors = [...colors];
  const backColors = [...colors].sort(() => Math.random() - 0.5);

  let deck = frontColors.map((frontColor, i) => ({
    id: i,
    frontColor,
    backColor: backColors[i],
  }));

  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

// --- INITIAL STATE ---
export function getInitialState(): GameState {
  const initialDeck = createDeck();
  const player1Hand: Card[] = [];
  const player2Hand: Card[] = [];

  for (let i = 0; i < HAND_SIZE; i++) {
    player1Hand.push(initialDeck.pop()!);
    player2Hand.push(initialDeck.pop()!);
  }
  
  const players: [Player, Player] = [
    { id: 1, name: 'Jugador 1', hand: player1Hand, discardPile: [] },
    { id: 2, name: 'Jugador 2', hand: player2Hand, discardPile: [] },
  ];

  return {
    phase: 'PLAYING',
    players,
    deck: initialDeck,
    centerRow: [],
    currentPlayerIndex: Math.random() < 0.5 ? 0 : 1,
    turnState: 'PLAYING',
    canFlipInitially: true,
    playedCardsThisTurn: 0,
    roundEndReason: null,
    roundWinner: null,
    roundLoser: null,
    gameWinner: null,
    isTie: false,
    lastActionLog: 'La partida ha comenzado.',
    turnTimer: TURN_TIME_SECONDS
  };
}

// --- GAME LOGIC HELPERS ---
function checkRowState(centerRow: CenterRowCard[]): { state: RowState; color?: Color } {
  const visibleColors = new Set<Color>();
  for (const card of centerRow) {
    if (!card.isFaceUp) continue;

    const color = card.frontColor;
    if (color === 'Black') {
      return { state: 'BLACK_CARD' };
    }
    if (color !== 'White') {
      if (visibleColors.has(color)) {
        return { state: 'DUPLICATE_COLOR', color };
      }
      visibleColors.add(color);
    }
  }
  return { state: 'VALID' };
}

function isRainbowComplete(centerRow: CenterRowCard[]): boolean {
  return centerRow.length === RAINBOW_SIZE;
}

// --- REDUCER ---
export type GameAction =
  | { type: 'PLAY_CARD'; payload: { handIndex: number; isBlind: boolean } }
  | { type: 'END_TURN' }
  | { type: 'START_NEXT_ROUND' }
  | { type: 'RESTART_GAME' }
  | { type: 'TICK_TIMER' }
  | { type: 'INITIALIZE_GAME'; payload: GameState };


export function gameReducer(state: GameState, action: GameAction): GameState {
   if (action.type === 'INITIALIZE_GAME') {
    return action.payload;
  }
  if (state.phase !== 'PLAYING') {
    if (action.type === 'RESTART_GAME') return getInitialState();
    return state;
  }
  
  switch (action.type) {
    case 'PLAY_CARD': {
      const { handIndex, isBlind } = action.payload;
      const currentPlayer = state.players[state.currentPlayerIndex];
      const cardToPlay = currentPlayer.hand[handIndex];
      
      if (!cardToPlay || state.turnState !== 'PLAYING') return state;

      const newHand = currentPlayer.hand.filter((_, i) => i !== handIndex);

      const cardForCenter: Card = { 
        ...cardToPlay, 
        frontColor: isBlind ? cardToPlay.backColor : cardToPlay.frontColor,
        backColor: isBlind ? cardToPlay.frontColor : cardToPlay.backColor,
      };
      
      const newCenterRowCard: CenterRowCard = { 
        ...cardForCenter,
        isFaceUp: true, // Card is always face up
      };

      const logMessage = isBlind 
        ? `${currentPlayer.name} jugó una carta a ciegas, revelando un ${newCenterRowCard.frontColor}.`
        : `${currentPlayer.name} jugó un ${newCenterRowCard.frontColor}.`;

      const newState: GameState = {
        ...state,
        players: state.players.map((p, i) => i === state.currentPlayerIndex ? { ...p, hand: newHand } : p) as [Player, Player],
        centerRow: [...state.centerRow, newCenterRowCard],
        playedCardsThisTurn: state.playedCardsThisTurn + 1,
        canFlipInitially: false,
        lastActionLog: logMessage
      };
      
      const { state: rowState, color: duplicateColor } = checkRowState(newState.centerRow);
      
      if (rowState === 'BLACK_CARD') {
        return { ...newState, roundEndReason: 'BLACK_CARD', lastActionLog: `${currentPlayer.name} reveló una carta Negra y perdió la ronda.` };
      }
      if (rowState === 'DUPLICATE_COLOR') {
        return { ...newState, roundEndReason: 'DUPLICATE_COLOR', lastActionLog: `${currentPlayer.name} reveló un color repetido (${duplicateColor}) y perdió la ronda.` };
      }
      if (isRainbowComplete(newState.centerRow)) {
        return { ...newState, roundEndReason: 'RAINBOW_COMPLETE', lastActionLog: `${currentPlayer.name} completó un ARCOÍRIS!` };
      }
      if (newState.playedCardsThisTurn === 3) {
        return endTurn(newState);
      }
      
      return newState;
    }

    case 'END_TURN': {
      return endTurn(state);
    }

    case 'START_NEXT_ROUND': {
      if (!state.roundEndReason) return state;

      let roundWinnerIndex: number;
      let nextPlayerIndex: number;
      
      const newPlayers = [...state.players] as [Player, Player];
      let newCenterRow: CenterRowCard[] = [];

      if (state.roundEndReason === 'RAINBOW_COMPLETE') {
        roundWinnerIndex = state.currentPlayerIndex;
        nextPlayerIndex = 1 - roundWinnerIndex; // Opponent starts
        newPlayers[roundWinnerIndex].discardPile.push(...state.centerRow);
      } else { // DUPLICATE_COLOR or BLACK_CARD
        roundWinnerIndex = 1 - state.currentPlayerIndex;
        nextPlayerIndex = state.currentPlayerIndex; // Loser starts
        newPlayers[roundWinnerIndex].discardPile.push(...state.centerRow);
      }
      
      // Draw cards
      const newDeck = [...state.deck];
      let isGameOver = false;
      
      for (let i = 0; i < newPlayers.length; i++) {
        while (newPlayers[i].hand.length < HAND_SIZE) {
          if (newDeck.length > 0) {
            newPlayers[i].hand.push(newDeck.pop()!);
          } else {
            isGameOver = true;
            break;
          }
        }
        if (isGameOver) break;
      }
      
      if(isGameOver) {
        return checkGameOver(state);
      }
      
      return {
        ...state,
        players: newPlayers,
        deck: newDeck,
        centerRow: newCenterRow,
        currentPlayerIndex: nextPlayerIndex as 0 | 1,
        turnState: 'PLAYING',
        canFlipInitially: true,
        playedCardsThisTurn: 0,
        roundEndReason: null,
        lastActionLog: `${newPlayers[roundWinnerIndex].name} ganó la ronda. ${newPlayers[nextPlayerIndex].name} empieza.`,
        turnTimer: TURN_TIME_SECONDS
      };
    }
    
    case 'RESTART_GAME':
      return getInitialState();
      
    case 'TICK_TIMER': {
      if (state.turnTimer > 0) {
        return { ...state, turnTimer: state.turnTimer - 1 };
      } else {
        return endTurn({ ...state, lastActionLog: `${state.players[state.currentPlayerIndex].name} se quedó sin tiempo. Turno finalizado.` });
      }
    }

    default:
      return state;
  }
}


function endTurn(state: GameState): GameState {
  const newDeck = [...state.deck];
  const newPlayers = [...state.players] as [Player, Player];
  let isGameOver = false;

  for (let i = 0; i < newPlayers.length; i++) {
    while (newPlayers[i].hand.length < HAND_SIZE) {
      if (newDeck.length > 0) {
        newPlayers[i].hand.push(newDeck.pop()!);
      } else {
        isGameOver = true;
        break;
      }
    }
    if (isGameOver) break;
  }
  
  if (isGameOver) {
    return checkGameOver(state);
  }

  const nextPlayerIndex = (1 - state.currentPlayerIndex) as 0 | 1;

  return {
    ...state,
    deck: newDeck,
    players: newPlayers,
    currentPlayerIndex: nextPlayerIndex,
    turnState: 'PLAYING',
    canFlipInitially: true,
    playedCardsThisTurn: 0,
    lastActionLog: state.lastActionLog.includes('tiempo') ? state.lastActionLog : `${state.players[state.currentPlayerIndex].name} terminó su turno. Turno de ${newPlayers[nextPlayerIndex].name}.`,
    turnTimer: TURN_TIME_SECONDS
  };
}


function checkGameOver(state: GameState): GameState {
    const p1Score = state.players[0].discardPile.length;
    const p2Score = state.players[1].discardPile.length;
    let winner = null;
    let isTie = false;

    if (p1Score > p2Score) {
      winner = state.players[0];
    } else if (p2Score > p1Score) {
      winner = state.players[1];
    } else {
      isTie = true;
    }
    
    return {
      ...state,
      phase: 'GAME_OVER',
      gameWinner: winner,
      isTie: isTie,
      lastActionLog: isTie ? `¡Empate!` : `Fin de la partida. ¡${winner?.name} gana!`,
    }
}


// --- CUSTOM HOOK ---
export function useGameLogic() {
  // We pass a dummy initial state to the reducer, it will be initialized in the useEffect
  const [state, dispatch] = useReducer(gameReducer, {} as GameState, getInitialState);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Only run on client
    if (typeof window !== 'undefined') {
      dispatch({ type: 'INITIALIZE_GAME', payload: getInitialState() });
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (!isInitialized || state.phase !== 'PLAYING') return;

    const timer = setInterval(() => {
      dispatch({ type: 'TICK_TIMER' });
    }, 1000);

    return () => clearInterval(timer);
  }, [isInitialized, state.phase, state.currentPlayerIndex]); // Reset timer on turn change

  return { state, dispatch, isInitialized };
}
