
'use client';
import type { GameState, Player, Card, Color, CenterRowCard, TurnState, RowState, GamePhase } from './types';
import { doc, updateDoc, serverTimestamp, DocumentReference } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

// --- CONSTANTS ---
const HAND_SIZE = 3;
const TURN_TIME_SECONDS = 60;


// Helper to update Firestore without blocking.
// This should be called from the reducer after the state has been updated.
function updateRemoteState(matchRef: DocumentReference | null, newState: GameState) {
    if (!matchRef) return;

    const updateData = {
        gameState: newState,
        status: newState.phase === 'GAME_OVER' ? 'GAME_OVER' : 'PLAYING' as const,
        updatedAt: serverTimestamp()
    };
    
    updateDoc(matchRef, updateData).catch(e => {
        console.error("Failed to update remote state:", e);
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({
            path: matchRef.path,
            operation: 'update',
            requestResourceData: updateData,
          })
        );
    });
}


// --- DECK CREATION ---
function createDeck(): Card[] {
  const colorCounts: Record<Color, number> = {
    Red: 6, Orange: 6, Yellow: 6, Green: 6, Blue: 6, Indigo: 6, Violet: 6,
    White: 8, Black: 6,
  };

  let colors: Color[] = [];
  (Object.keys(colorCounts) as Color[]).forEach(color => {
    for (let i = 0; i < colorCounts[color]; i++) {
      colors.push(color);
    }
  });

  // Fisher-Yates shuffle for a random initial order
  for (let i = colors.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [colors[i], colors[j]] = [colors[j], colors[i]];
  }
  
  const frontColors = [...colors];
  const backColors = [...colors].sort(() => 0.5 - Math.random());
  
  // Ensure no card has the same front and back color
  for (let i = 0; i < frontColors.length; i++) {
    if (frontColors[i] === backColors[i]) {
      // Find a card to swap with
      let swapIndex = -1;
      
      // Look forward for a suitable swap
      for (let j = i + 1; j < frontColors.length; j++) {
        // A suitable swap is one where:
        // 1. The back color at j is not the same as the front color at i
        // 2. The back color at i (which is the same as front color at i) is not the same as the front color at j
        if (backColors[j] !== frontColors[i] && backColors[i] !== frontColors[j]) {
          swapIndex = j;
          break;
        }
      }

      // If no suitable swap found going forward, look backward (less likely but a good fallback)
      if (swapIndex === -1) {
        for (let j = 0; j < i; j++) {
           if (backColors[j] !== frontColors[i] && backColors[i] !== frontColors[j]) {
             swapIndex = j;
             break;
           }
        }
      }

      if (swapIndex !== -1) {
        [backColors[i], backColors[swapIndex]] = [backColors[swapIndex], backColors[i]];
      } else {
         // This case is extremely unlikely with a shuffled deck of this size,
         // but as a last resort, we'll swap with the next card, even if it creates a new conflict
         // which the next loop iteration might fix.
         const nextIndex = (i + 1) % backColors.length;
         [backColors[i], backColors[nextIndex]] = [backColors[nextIndex], backColors[i]];
      }
    }
  }

  let deck = frontColors.map((frontColor, i) => ({
    id: i,
    frontColor,
    backColor: backColors[i], 
  }));

  // Final shuffle of the correctly constructed deck
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

// --- INITIAL STATE ---
export function getInitialGameState(players: Player[]): GameState {
  const initialDeck = createDeck();
  
  const validatedPlayers = players.map(p => {
      if (!p || !p.id || !p.name) {
          throw new Error("Invalid player object provided to getInitialGameState");
      }
      return { ...p, hand: [], discardPile: [] };
  });
  
  validatedPlayers.forEach(player => {
    for (let i = 0; i < HAND_SIZE; i++) {
      if (initialDeck.length > 0) {
        player.hand.push(initialDeck.pop()!);
      }
    }
  });


  return {
    phase: 'PLAYING',
    players: validatedPlayers,
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

// --- GAME LOGIC HELPERS ---
function checkRowState(centerRow: CenterRowCard[]): { state: RowState; color?: Color } {
  const visibleColors = new Set<Color>();
  for (const card of centerRow) {
    if(card.isFaceUp) {
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
  }
  return { state: 'VALID' };
}

function isRainbowComplete(centerRow: CenterRowCard[]): boolean {
  const uniqueColors = new Set<Color>();
  centerRow.forEach(card => {
    if (card.isFaceUp && card.frontColor !== 'White' && card.frontColor !== 'Black') {
      uniqueColors.add(card.frontColor);
    }
  });
  return uniqueColors.size >= 6;
}


// --- REDUCER ---
export type GameAction =
  | { type: 'SET_GAME_STATE'; payload: GameState }
  | { type: 'PLAY_CARD'; payload: { handIndex: number; isBlind: boolean } }
  | { type: 'END_TURN' }
  | { type: 'START_NEXT_ROUND' }
  | { type: 'RESTART_GAME' }
  | { type: 'TICK_TIMER' };


// We pass matchRef to the reducer so it can trigger remote updates.
// This moves the responsibility of updating Firestore out of the component's useEffect.
export function createGameReducer(matchRef: DocumentReference | null) {
  const reducer = (state: GameState, action: GameAction): GameState => {
    let newState: GameState | null = null;

    // The main logic is wrapped in a function to avoid duplicating the remote update call.
    const computeNewState = (): GameState | null => {
      if (action.type === 'SET_GAME_STATE') {
        // This action is only for syncing remote state to local, so we don't update remote.
        return action.payload;
      }
      
      if (!state || !state.phase) {
        return state;
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

          const tempState: GameState = {
            ...state,
            players: state.players.map((p, i) => i === state.currentPlayerIndex ? { ...p, hand: newHand } : p),
            centerRow: [...state.centerRow, newCenterRowCard],
            playedCardsThisTurn: state.playedCardsThisTurn + 1,
            lastActionLog: logMessage
          };
          
          const { state: rowState, color: duplicateColor } = checkRowState(tempState.centerRow);
          
          if (rowState === 'BLACK_CARD') {
            return { ...tempState, turnState: 'ROUND_OVER', roundEndReason: 'BLACK_CARD', lastActionLog: `${currentPlayer.name} reveló una carta Negra y perdió la ronda.` };
          } else if (rowState === 'DUPLICATE_COLOR') {
            return { ...tempState, turnState: 'ROUND_OVER', roundEndReason: 'DUPLICATE_COLOR', lastActionLog: `${currentPlayer.name} reveló un color repetido (${duplicateColor}) y perdió la ronda.` };
          } else if (isRainbowComplete(tempState.centerRow)) {
            return { ...tempState, turnState: 'ROUND_OVER', roundEndReason: 'RAINBOW_COMPLETE', lastActionLog: `${currentPlayer.name} completó un ARCOÍRIS!` };
          } else {
            return tempState;
          }
        }

        case 'END_TURN': {
          return endTurn(state);
        }

        case 'START_NEXT_ROUND': {
          if (!state.roundEndReason) return state;
          return startNextRound(state);
        }
        
        case 'RESTART_GAME': {
          if (state.players.length === 2) {
            const newPlayerObjects = state.players.map(p => ({ id: p.id, name: p.name, hand: [], discardPile: [] }));
            return getInitialGameState(newPlayerObjects);
          } else {
            return state;
          }
        }
          
        case 'TICK_TIMER': {
          if (state.phase !== 'PLAYING' || state.turnState !== 'PLAYING') return state;
          if (state.turnTimer > 0) {
            // Timer ticks don't need to be persisted to Firestore, so we return early without updating remote.
            return { ...state, turnTimer: state.turnTimer - 1 };
          } else {
            return endTurn({ ...state, lastActionLog: `${state.players[state.currentPlayerIndex].name} se quedó sin tiempo. Turno finalizado.` });
          }
        }

        default:
          return state;
      }
    }

    newState = computeNewState();
    
    // After the new state is calculated, update the remote state if it changed and it's not a timer tick
    if (newState && newState !== state && action.type !== 'SET_GAME_STATE' && action.type !== 'TICK_TIMER') {
      updateRemoteState(matchRef, newState);
    }
    
    return newState || state;
  }
  
  return reducer;
}


function endTurn(state: GameState): GameState {
  const newDeck = [...state.deck];
  const newPlayers = JSON.parse(JSON.stringify(state.players));
  const currentPlayer = newPlayers[state.currentPlayerIndex];
  let isGameOver = false;
  let logMessage = state.lastActionLog;
  let newCenterRow = [...state.centerRow];

  if (state.playedCardsThisTurn > 0) {
      const cardsToDraw = state.playedCardsThisTurn;
      for (let i = 0; i < cardsToDraw; i++) {
        if (newDeck.length > 0) {
          currentPlayer.hand.push(newDeck.pop()!);
        } else {
          isGameOver = true;
          break;
        }
      }
      logMessage = state.lastActionLog.includes('tiempo') ? state.lastActionLog : `${currentPlayer.name} terminó su turno.`;
  } else {
      newCenterRow = state.centerRow.map(card => ({...card, isFaceUp: false}));
      logMessage = `${currentPlayer.name} ha pasado el turno. Las cartas de la fila se han volteado.`;
  }

  const nextPlayerIndex = ((state.currentPlayerIndex + 1) % 2) as 0 | 1;
  
  const updatedState: GameState = {
    ...state,
    deck: newDeck,
    players: newPlayers,
    centerRow: newCenterRow,
    currentPlayerIndex: nextPlayerIndex,
    turnState: 'PLAYING',
    playedCardsThisTurn: 0,
    lastActionLog: `${logMessage} Turno de ${newPlayers[nextPlayerIndex].name}.`,
    turnTimer: TURN_TIME_SECONDS,
  };

  if (isGameOver) {
    return checkGameOver(updatedState);
  }

  return updatedState;
}

function startNextRound(state: GameState): GameState {
    let roundWinnerIndex: number;
    let nextPlayerIndex: number;
    
    const newPlayers = JSON.parse(JSON.stringify(state.players));
    const cardsToAward = state.centerRow.map(c => ({...c, isFaceUp: true} as Card));

    if (state.roundEndReason === 'RAINBOW_COMPLETE') {
      roundWinnerIndex = state.currentPlayerIndex;
      nextPlayerIndex = (roundWinnerIndex + 1) % 2;
      newPlayers[roundWinnerIndex].discardPile.push(...cardsToAward);
    } else { // DUPLICATE_COLOR or BLACK_CARD
      roundWinnerIndex = (state.currentPlayerIndex + 1) % 2;
      nextPlayerIndex = state.currentPlayerIndex;
      newPlayers[roundWinnerIndex].discardPile.push(...cardsToAward);
    }
    const roundWinnerId = newPlayers[roundWinnerIndex].id;
    
    const newDeck = [...state.deck];
    let isGameOver = false;
    
    for (let i = 0; i < newPlayers.length; i++) {
      const player = newPlayers[i];
      const cardsNeeded = HAND_SIZE - player.hand.length;
      if (cardsNeeded > 0) {
        for(let j = 0; j < cardsNeeded; j++) {
          if (newDeck.length > 0) {
            player.hand.push(newDeck.pop()!);
          } else {
            isGameOver = true;
            break;
          }
        }
      }
      if (isGameOver) break;
    }
    
    const updatedState: GameState = {
      ...state,
      players: newPlayers,
      deck: newDeck,
      centerRow: [],
      currentPlayerIndex: nextPlayerIndex as 0 | 1,
      turnState: 'PLAYING',
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

    
