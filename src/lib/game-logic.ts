'use client';
import type { GameState, Player, Card, Color, CenterRowCard, TurnState, RowState, GamePhase } from './types';
import { COLORS, RAINBOW_COLORS } from './types';
import { useReducer, useEffect, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase/provider';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';


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
  const backColors = [...colors].sort(() => 0.5 - Math.random());

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
export function getInitialGameState(players: Player[]): GameState {
  const initialDeck = createDeck();
  
  players.forEach(player => {
    player.hand = [];
    player.discardPile = [];
  });
  
  // Deal cards only if the game is actually starting (2 players)
  if (players.length === 2) {
    players.forEach(player => {
      for (let i = 0; i < HAND_SIZE; i++) {
        if (initialDeck.length > 0) {
          player.hand.push(initialDeck.pop()!);
        }
      }
    });
  } else {
    // If only one player, deal cards but wait for the second player
    const player1 = players[0];
     for (let i = 0; i < HAND_SIZE; i++) {
        if (initialDeck.length > 0) {
          player1.hand.push(initialDeck.pop()!);
        }
      }
  }


  return {
    phase: players.length === 2 ? 'PLAYING': 'LOBBY',
    players: players,
    deck: initialDeck,
    centerRow: [],
    currentPlayerIndex: Math.random() < 0.5 ? 0 : 1,
    turnState: 'PLAYING',
    playedCardsThisTurn: 0,
    roundEndReason: null,
    roundWinnerId: null,
    gameWinnerId: null,
    isTie: false,
    lastActionLog: 'La partida ha comenzado.',
    turnTimer: TURN_TIME_SECONDS
  };
}

// Adds a second player and deals cards to both, starting the game.
export function addSecondPlayer(currentState: GameState, player2: Player): GameState {
  if (currentState.players.length >= 2) {
    return currentState;
  }
  
  const player1 = currentState.players[0];
  const players = [player1, player2];
  const deck = [...currentState.deck];

  // Clear any pre-dealt hands and deal fresh to both
  player1.hand = [];
  player2.hand = [];

  for (let i = 0; i < HAND_SIZE * 2; i++) {
    const playerIndex = i % 2;
    if (deck.length > 0) {
      players[playerIndex].hand.push(deck.pop()!);
    }
  }

  return {
    ...currentState,
    phase: 'PLAYING',
    players,
    deck,
    currentPlayerIndex: Math.random() < 0.5 ? 0 : 1, // Randomize start
    lastActionLog: `${player2.name} se ha unido. ¡La partida comienza!`,
  };
}

// --- GAME LOGIC HELPERS ---
function checkRowState(centerRow: CenterRowCard[]): { state: RowState; color?: Color } {
  const visibleColors = new Set<Color>();
  for (const card of centerRow) {
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
  const uniqueColors = new Set(centerRow.map(c => c.frontColor).filter(c => c !== 'White'));
  return uniqueColors.size >= RAINBOW_SIZE;
}

// --- REDUCER ---
export type GameAction =
  | { type: 'SET_GAME_STATE'; payload: GameState }
  | { type: 'PLAY_CARD'; payload: { handIndex: number; isBlind: boolean } }
  | { type: 'END_TURN' }
  | { type: 'START_NEXT_ROUND' }
  | { type: 'RESTART_GAME' }
  | { type: 'TICK_TIMER' };


export function gameReducer(state: GameState, action: GameAction): GameState {
   if (action.type === 'SET_GAME_STATE') {
    return action.payload;
  }
   if (!state || !state.phase) {
    return {} as GameState; // Return empty state if not initialized
  }

  if (state.phase !== 'PLAYING') {
    if (action.type === 'RESTART_GAME' && state.players.length === 2) {
       const newPlayerObjects = state.players.map(p => ({ ...p, hand: [], discardPile: [] }));
       return getInitialGameState(newPlayerObjects);
    }
    return state;
  }
  
  switch (action.type) {
    case 'PLAY_CARD': {
      const { handIndex, isBlind } = action.payload;
      const currentPlayer = state.players[state.currentPlayerIndex];
      const cardToPlay = currentPlayer.hand[handIndex];
      
      if (!cardToPlay || state.turnState === 'ROUND_OVER' || state.playedCardsThisTurn >= 3) return state;

      const newHand = currentPlayer.hand.filter((_, i) => i !== handIndex);

      const cardForCenter: Card = { 
        ...cardToPlay, 
        frontColor: isBlind ? cardToPlay.backColor : cardToPlay.frontColor,
        backColor: isBlind ? cardToPlay.frontColor : cardToPlay.backColor,
      };
      
      const newCenterRowCard: CenterRowCard = { 
        ...cardForCenter,
        isFaceUp: true,
      };

      const logMessage = isBlind 
        ? `${currentPlayer.name} jugó una carta a ciegas, revelando un ${newCenterRowCard.frontColor}.`
        : `${currentPlayer.name} jugó un ${newCenterRowCard.frontColor}.`;

      const newState: GameState = {
        ...state,
        players: state.players.map((p, i) => i === state.currentPlayerIndex ? { ...p, hand: newHand } : p),
        centerRow: [...state.centerRow, newCenterRowCard],
        playedCardsThisTurn: state.playedCardsThisTurn + 1,
        lastActionLog: logMessage
      };
      
      const { state: rowState, color: duplicateColor } = checkRowState(newState.centerRow);
      
      if (rowState === 'BLACK_CARD') {
        return { ...newState, turnState: 'ROUND_OVER', roundEndReason: 'BLACK_CARD', lastActionLog: `${currentPlayer.name} reveló una carta Negra y perdió la ronda.` };
      }
      if (rowState === 'DUPLICATE_COLOR') {
        return { ...newState, turnState: 'ROUND_OVER', roundEndReason: 'DUPLICATE_COLOR', lastActionLog: `${currentPlayer.name} reveló un color repetido (${duplicateColor}) y perdió la ronda.` };
      }
      if (isRainbowComplete(newState.centerRow)) {
        return { ...newState, turnState: 'ROUND_OVER', roundEndReason: 'RAINBOW_COMPLETE', lastActionLog: `${currentPlayer.name} completó un ARCOÍRIS!` };
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
      
      const newPlayers = [...state.players];
      
      if (state.roundEndReason === 'RAINBOW_COMPLETE') {
        roundWinnerIndex = state.currentPlayerIndex;
        nextPlayerIndex = 1 - roundWinnerIndex; // Opponent starts
        newPlayers[roundWinnerIndex].discardPile.push(...state.centerRow.map(c => ({...c, isFaceUp: true})));
      } else { // DUPLICATE_COLOR or BLACK_CARD
        roundWinnerIndex = 1 - state.currentPlayerIndex;
        nextPlayerIndex = state.currentPlayerIndex; // Loser starts
        newPlayers[roundWinnerIndex].discardPile.push(...state.centerRow.map(c => ({...c, isFaceUp: true})));
      }
      const roundWinnerId = newPlayers[roundWinnerIndex].id;
      
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
      
      const updatedState = {
        ...state,
        players: newPlayers,
        deck: newDeck,
        centerRow: [],
        currentPlayerIndex: nextPlayerIndex as 0 | 1,
        turnState: 'PLAYING' as TurnState,
        playedCardsThisTurn: 0,
        roundEndReason: null,
        roundWinnerId,
        lastActionLog: `${newPlayers[roundWinnerIndex].name} ganó la ronda. ${newPlayers[nextPlayerIndex].name} empieza.`,
        turnTimer: TURN_TIME_SECONDS
      };
      
      if(isGameOver) {
        return checkGameOver(updatedState);
      }
      
      return updatedState;
    }
    
    case 'RESTART_GAME':
       if (state.players.length === 2) {
          const newPlayerObjects = state.players.map(p => ({ id: p.id, name: p.name, hand: [], discardPile: [] }));
          return getInitialGameState(newPlayerObjects);
        }
        return state;
      
    case 'TICK_TIMER': {
       if (state.phase !== 'PLAYING' || state.turnState !== 'PLAYING') return state;
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
  const newPlayers = [...state.players];
  let isGameOver = false;

  newPlayers.forEach(p => {
      while (p.hand.length < HAND_SIZE) {
        if (newDeck.length > 0) {
            p.hand.push(newDeck.pop()!);
        } else {
            isGameOver = true;
            return;
        }
      }
  })
  
  const nextPlayerIndex = (1 - state.currentPlayerIndex) as 0 | 1;

  const updatedState = {
    ...state,
    deck: newDeck,
    players: newPlayers,
    currentPlayerIndex: nextPlayerIndex,
    turnState: 'PLAYING' as TurnState,
    playedCardsThisTurn: 0,
    lastActionLog: state.lastActionLog.includes('tiempo') ? state.lastActionLog : `${state.players[state.currentPlayerIndex].name} terminó su turno. Turno de ${newPlayers[nextPlayerIndex].name}.`,
    turnTimer: TURN_TIME_SECONDS
  };

  if (isGameOver) {
    return checkGameOver(updatedState);
  }

  return updatedState;
}


function checkGameOver(state: GameState): GameState {
    if (state.players.length < 2) return state;
    const p1Score = state.players[0].discardPile.length;
    const p2Score = state.players[1].discardPile.length;
    let winnerId = null;
    let isTie = false;

    if (p1Score > p2Score) {
      winnerId = state.players[0].id;
    } else if (p2Score > p1Score) {
      winnerId = state.players[1].id;
    } else {
      isTie = true;
    }
    
    return {
      ...state,
      phase: 'GAME_OVER' as GamePhase,
      gameWinnerId: winnerId,
      isTie: isTie,
      lastActionLog: isTie ? `¡Empate!` : `Fin de la partida. ¡${winnerId === state.players[0].id ? state.players[0].name : state.players[1].name} gana!`,
    }
}


// --- CUSTOM HOOK ---
export function useGameLogic(matchId: string, initialMatchState: GameState) {
  const [state, dispatch] = useReducer(gameReducer, initialMatchState);
  const firestore = useFirestore();
  const { user } = useUser();
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Effect to update local state when initialMatchState from props changes
  useEffect(() => {
    if (initialMatchState) {
      dispatch({ type: 'SET_GAME_STATE', payload: initialMatchState });
      setIsInitialized(true);
    }
  }, [initialMatchState]);


  // Effect to tick timer
  useEffect(() => {
    if (!isInitialized || !user || state.phase !== 'PLAYING' || state.players[state.currentPlayerIndex]?.id !== user.uid) {
        return;
    }

    const timer = setInterval(() => {
      dispatch({ type: 'TICK_TIMER' });
    }, 1000);

    return () => clearInterval(timer);
  }, [isInitialized, state.phase, state.currentPlayerIndex, state.turnTimer, state.players, user]);

  // Effect to sync state to Firestore
  useEffect(() => {
    if (!isInitialized || !user || !state.phase || !state.players.find(p => p.id === user.uid)) return;

    // Only the current player or a player in a ROUND_OVER state should update the state
    const isMyTurn = state.players[state.currentPlayerIndex]?.id === user.uid;
    const isRoundOverForMe = state.turnState === 'ROUND_OVER' && isMyTurn;

    if (isMyTurn || isRoundOverForMe) {
      const matchRef = doc(firestore, 'matches', matchId);
      setDocumentNonBlocking(matchRef, { gameState: state }, { merge: true });
    }

  }, [state, matchId, firestore, isInitialized, user]);

  return { state, dispatch, isInitialized };
}
