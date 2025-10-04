'use client';

import type { GameState, Player, Card, Color, CenterRowCard, GamePhase } from './types';

// --- CONSTANTS ---
const HAND_SIZE = 3;
const TURN_TIME_SECONDS = 60;

// --- DECK CREATION ---
function createDeck(): Card[] {
  const colorCounts: Record<Color, number> = {
    Red: 6,
    Orange: 6,
    Yellow: 6,
    Green: 6,
    Blue: 6,
    Indigo: 6,
    Violet: 6,
    White: 8,
    Black: 6,
  };

  const colors: Color[] = [];
  (Object.keys(colorCounts) as Color[]).forEach((color) => {
    for (let i = 0; i < colorCounts[color]; i++) {
      colors.push(color);
    }
  });

  const frontColors = [...colors];
  const backColors = [...colors].sort(() => 0.5 - Math.random());

  const deck = frontColors.map((frontColor, index) => ({
    id: index,
    frontColor,
    backColor: backColors[index],
  }));

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

// --- INITIAL STATE ---
export function getInitialGameState(players: Player[]): GameState {
  const initialDeck = createDeck();

  const validatedPlayers = players.map<Player>((player) => {
    if (!player || !player.id || !player.name) {
      throw new Error('Invalid player object provided to getInitialGameState');
    }

    return { ...player, hand: [] as Card[], discardPile: [] as Card[] };
  });

  validatedPlayers.forEach((player) => {
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
    turnTimer: TURN_TIME_SECONDS,
  };
}

// --- GAME LOGIC HELPERS ---
function checkRowState(centerRow: CenterRowCard[]): { state: 'VALID' | 'BLACK_CARD' | 'DUPLICATE_COLOR'; color?: Color } {
  const visibleColors = new Set<Color>();
  for (const card of centerRow) {
    if (card.isFaceUp) {
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
  const uniqueColors = new Set(
    centerRow
      .filter((card) => card.isFaceUp)
      .map((card) => card.frontColor)
      .filter((color) => color !== 'White'),
  );
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

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (action.type === 'SET_GAME_STATE') {
    return action.payload;
  }

  if (!state || !state.phase) {
    return state;
  }

  if (state.phase !== 'PLAYING') {
    if (action.type === 'RESTART_GAME' && state.players.length === 2) {
      const newPlayerObjects = state.players.map((player) => ({ ...player, hand: [], discardPile: [] }));
      return getInitialGameState(newPlayerObjects);
    }
    return state;
  }

  switch (action.type) {
    case 'PLAY_CARD': {
      const { handIndex, isBlind } = action.payload;
      const currentPlayer = state.players[state.currentPlayerIndex];
      const cardToPlay = currentPlayer.hand[handIndex];

      if (!cardToPlay || state.turnState === 'ROUND_OVER' || state.playedCardsThisTurn >= 3) {
        return state;
      }

      const newHand = currentPlayer.hand.filter((_, index) => index !== handIndex);
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
        players: state.players.map((player, index) =>
          index === state.currentPlayerIndex ? { ...player, hand: newHand } : player,
        ),
        centerRow: [...state.centerRow, newCenterRowCard],
        playedCardsThisTurn: state.playedCardsThisTurn + 1,
        lastActionLog: logMessage,
      };

      const { state: rowState, color: duplicateColor } = checkRowState(tempState.centerRow);

      if (rowState === 'BLACK_CARD') {
        return {
          ...tempState,
          turnState: 'ROUND_OVER',
          roundEndReason: 'BLACK_CARD',
          lastActionLog: `${currentPlayer.name} reveló una carta Negra y perdió la ronda.`,
        };
      }

      if (rowState === 'DUPLICATE_COLOR') {
        return {
          ...tempState,
          turnState: 'ROUND_OVER',
          roundEndReason: 'DUPLICATE_COLOR',
          lastActionLog: `${currentPlayer.name} reveló un color repetido (${duplicateColor}) y perdió la ronda.`,
        };
      }

      if (isRainbowComplete(tempState.centerRow)) {
        return {
          ...tempState,
          turnState: 'ROUND_OVER',
          roundEndReason: 'RAINBOW_COMPLETE',
          lastActionLog: `${currentPlayer.name} completó un ARCOÍRIS!`,
        };
      }

      return tempState;
    }

    case 'END_TURN': {
      return endTurn(state);
    }

    case 'START_NEXT_ROUND': {
      if (!state.roundEndReason) {
        return state;
      }
      return startNextRound(state);
    }

    case 'RESTART_GAME': {
      if (state.players.length === 2) {
        const newPlayerObjects = state.players.map((player) => ({ id: player.id, name: player.name, hand: [], discardPile: [] }));
        return getInitialGameState(newPlayerObjects);
      }
      return state;
    }

    case 'TICK_TIMER': {
      if (state.phase !== 'PLAYING' || state.turnState !== 'PLAYING') {
        return state;
      }

      if (state.turnTimer > 0) {
        return { ...state, turnTimer: state.turnTimer - 1 };
      }

      return endTurn({
        ...state,
        lastActionLog: `${state.players[state.currentPlayerIndex].name} se quedó sin tiempo. Turno finalizado.`,
      });
    }

    default:
      return state;
  }
}

function endTurn(state: GameState): GameState {
  const newDeck = [...state.deck];
  const newPlayers = JSON.parse(JSON.stringify(state.players)) as GameState['players'];
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
    if (!logMessage.includes('tiempo')) {
      logMessage = `${currentPlayer.name} terminó su turno.`;
    }
  } else {
    newCenterRow = state.centerRow.map((card) => ({ ...card, isFaceUp: false }));
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
  const newPlayers = JSON.parse(JSON.stringify(state.players)) as GameState['players'];
  const cardsToAward = state.centerRow.map((card) => ({ ...card, isFaceUp: true } as Card));

  let roundWinnerIndex: number;
  let nextPlayerIndex: number;

  if (state.roundEndReason === 'RAINBOW_COMPLETE') {
    roundWinnerIndex = state.currentPlayerIndex;
    nextPlayerIndex = (roundWinnerIndex + 1) % 2;
    newPlayers[roundWinnerIndex].discardPile.push(...cardsToAward);
  } else {
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
      for (let j = 0; j < cardsNeeded; j++) {
        if (newDeck.length > 0) {
          player.hand.push(newDeck.pop()!);
        } else {
          isGameOver = true;
          break;
        }
      }
    }
    if (isGameOver) {
      break;
    }
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
    turnTimer: TURN_TIME_SECONDS,
  };

  if (isGameOver) {
    return checkGameOver(updatedState);
  }

  return updatedState;
}

function checkGameOver(state: GameState): GameState {
  if (state.players.length < 2) {
    return state;
  }

  const p1Score = state.players[0].discardPile.length;
  const p2Score = state.players[1].discardPile.length;

  let winnerId: string | null = null;
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
    isTie,
    lastActionLog: isTie
      ? '¡Empate!'
      : `Fin de la partida. ¡${winnerId === state.players[0].id ? state.players[0].name : state.players[1].name} gana!`,
  };
}
