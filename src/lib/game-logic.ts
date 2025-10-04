
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
  
  const frontColors = [...colors];
  const backColors = [...colors].sort(() => 0.5 - Math.random());
  
  // Ensure no card has the same front and back color
  for (let i = 0; i < frontColors.length; i++) {
    if (frontColors[i] === backColors[i]) {
      let swapped = false;
      // Look forward for a suitable swap
      for (let j = i + 1; j < frontColors.length; j++) {
        // A suitable swap is one where:
        // 1. The back color at j is not the same as the front color at i
        // 2. The back color at i (which is the same as front color at i) is not the same as the front color at j
        if (backColors[j] !== frontColors[i] && backColors[i] !== frontColors[j]) {
          [backColors[i], backColors[j]] = [backColors[j], backColors[i]];
          swapped = true;
          break;
        }
      }

      // If no suitable swap found going forward, look backward
      if (!swapped) {
        for (let j = 0; j < i; j++) {
           if (backColors[j] !== frontColors[i] && backColors[i] !== frontColors[j]) {
             [backColors[i], backColors[j]] = [backColors[j], backColors[i]];
             swapped = true;
             break;
           }
        }
      }
      
      // As a last resort if all else fails (highly improbable)
      if (!swapped) {
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
  
  const validatedPlayers = players.map((p, index) => {
      if (!p || !p.id) {
          // For initial setup before players are known, we can return a dummy structure.
          if (players.length === 0) {
              return { id: `dummy-${index}`, name: ``, hand: [], discardPile: [] };
          }
          throw new Error("Invalid player object provided to getInitialGameState");
      }
      // Assign names here to ensure consistency
      return { id: p.id, name: `Jugador ${index + 1}`, hand: [], discardPile: [] };
  });
  
  // Only deal cards if we have real players
  if (players.length > 0 && players[0].id) {
    validatedPlayers.forEach(player => {
        for (let i = 0; i < HAND_SIZE; i++) {
        if (initialDeck.length > 0) {
            player.hand.push(initialDeck.pop()!);
        }
        }
    });
  }


  return {
    phase: 'PLAYING',
    players: validatedPlayers,
    deck: initialDeck,
    centerRow: [],
    currentPlayerIndex: Math.random() < 0.5 ? 0 : 1,
    turnState: 'PLAYING',
    playedCardsThisTurn: 0,
    lastActionInTurn: 'NONE',
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
  return centerRow.length >= 6;
}


// --- REDUCER ---
export type GameAction =
  | { type: 'SET_GAME_STATE'; payload: GameState }
  | { type: 'PLAY_CARD'; payload: { handIndex: number; isBlind: boolean } }
  | { type: 'FLIP_CARD'; payload: { centerRowIndex: number } }
  | { type: 'END_TURN' }
  | { type: 'START_NEXT_ROUND' }
  | { type: 'RESTART_GAME' }
  | { type: 'TICK_TIMER' };


// We pass matchRef to the reducer so it can trigger remote updates.
// This moves the responsibility of updating Firestore out of the component's useEffect.
export function createGameReducer(matchRef: DocumentReference | null, currentUserId: string | null) {
  const reducer = (state: GameState, action: GameAction): GameState => {
    let newState: GameState | null = null;

    // The main logic is wrapped in a function to avoid duplicating the remote update call.
    const computeNewState = (): GameState | null => {
      if (action.type === 'SET_GAME_STATE') {
        // This action is only for syncing remote state to local, so we don't update remote.
        return action.payload;
      }
      
      if (!state || !state.phase || !currentUserId) {
        return state;
      }

      // Prevent actions from users who are not the current player
      const isMyTurn = state.players[state.currentPlayerIndex]?.id === currentUserId;
      if (['PLAY_CARD', 'FLIP_CARD', 'END_TURN'].includes(action.type) && !isMyTurn) {
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
          
          if (!currentPlayer.hand[handIndex] || state.turnState !== 'PLAYING' || state.playedCardsThisTurn >= 3) return state;
          if (state.lastActionInTurn === 'PLAY') return state; // Can't play twice in a row

          const cardToPlay = currentPlayer.hand[handIndex];
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
            
          const playedCardsThisTurn = state.playedCardsThisTurn + 1;
          const isFirstAction = state.lastActionInTurn === 'NONE';

          let tempState: GameState = {
            ...state,
            players: state.players.map((p, i) => i === state.currentPlayerIndex ? { ...p, hand: newHand } : p),
            centerRow: [...state.centerRow, newCenterRowCard],
            playedCardsThisTurn,
            lastActionInTurn: 'PLAY',
            lastActionLog: logMessage
          };
          
          // If it's the first action and it's a play, the turn ends immediately.
          if (isFirstAction) {
            tempState = endTurn(tempState, true); // Pass true to indicate an immediate turn end
          }
          
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
        
        case 'FLIP_CARD': {
          const { centerRowIndex } = action.payload;
          const currentPlayer = state.players[state.currentPlayerIndex];

          if (state.turnState !== 'PLAYING' || state.playedCardsThisTurn >= 3) return state;
          if (state.lastActionInTurn === 'FLIP' || state.lastActionInTurn === 'NONE') return state; // Can't flip twice or as first action

          const newCenterRow = [...state.centerRow];
          const cardToFlip = newCenterRow[centerRowIndex];
          if (!cardToFlip) return state;

          cardToFlip.isFaceUp = !cardToFlip.isFaceUp;
          const logMessage = `${currentPlayer.name} volteó una carta en la fila.`;
          
          let tempState: GameState = {
            ...state,
            centerRow: newCenterRow,
            lastActionInTurn: 'FLIP',
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
          if (state.playedCardsThisTurn === 0) return state; // Prevent ending turn without playing a card
          return endTurn(state, false);
        }

        case 'START_NEXT_ROUND': {
          if (!state.roundEndReason) return state;

          // Only the next player to act can start the round
          let nextPlayerToActIndex;
          if (state.roundEndReason === 'RAINBOW_COMPLETE') {
              nextPlayerToActIndex = 1 - state.currentPlayerIndex;
          } else { // DUPLICATE_COLOR or BLACK_CARD
              nextPlayerToActIndex = state.currentPlayerIndex;
          }
          if (state.players[nextPlayerToActIndex].id !== currentUserId) {
              return state;
          }

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
            return endTurn({ ...state, lastActionLog: `${state.players[state.currentPlayerIndex].name} se quedó sin tiempo. Turno finalizado.` }, false);
          }
        }

        default:
          return state;
      }
    }

    newState = computeNewState();
    
    // After the new state is calculated, update the remote state if it changed and it's not a timer tick
    if (newState && newState !== state && action.type !== 'TICK_TIMER' && (action.type !== 'SET_GAME_STATE')) {
      updateRemoteState(matchRef, newState);
    }
    
    return newState || state;
  }
  
  return reducer;
}


function endTurn(state: GameState, isImmediate: boolean): GameState {
  const newDeck = [...state.deck];
  const newPlayers = JSON.parse(JSON.stringify(state.players));
  const currentPlayer = newPlayers[state.currentPlayerIndex];
  let isGameOver = false;

  // Only draw if the turn is ending normally, not from an immediate play.
  const cardsToDraw = isImmediate ? 0 : state.playedCardsThisTurn;
  for (let i = 0; i < cardsToDraw; i++) {
    if (newDeck.length > 0) {
      currentPlayer.hand.push(newDeck.pop()!);
    } else {
      isGameOver = true;
      break;
    }
  }
  
  const logMessage = state.lastActionLog.includes('tiempo') 
    ? state.lastActionLog 
    : isImmediate
    ? `${state.lastActionLog} Fin del turno.`
    : `${currentPlayer.name} terminó su turno.`;

  const nextPlayerIndex = ((state.currentPlayerIndex + 1) % 2) as 0 | 1;
  
  const updatedState: GameState = {
    ...state,
    deck: newDeck,
    players: newPlayers,
    currentPlayerIndex: nextPlayerIndex,
    turnState: 'PLAYING',
    playedCardsThisTurn: 0,
    lastActionInTurn: 'NONE',
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
      lastActionInTurn: 'NONE',
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
