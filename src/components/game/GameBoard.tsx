'use client';

import { useReducer, useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { gameReducer, getInitialGameState } from '@/lib/game-logic';
import { PlayerHand } from './PlayerHand';
import { OpponentHand } from './OpponentHand';
import { CenterRow } from './CenterRow';
import { GameInfoPanel } from './GameInfoPanel';
import { ActionPanel } from './ActionPanel';
import { EndGameDialog } from './EndGameDialog';
import { RoundResultToast } from './RoundResultToast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthentication, useMatch, useMatchesActions } from '@/data';
import type { Match, GameState, Player } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { useRouter } from 'next/navigation';
import { isEqual } from 'lodash';
import { Button } from '@/components/ui/button';

function GameLoader() {
  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-16 md:col-span-3" />
      </div>
      <Skeleton className="h-48" />
      <Skeleton className="h-48" />
      <Skeleton className="h-48" />
    </div>
  );
}

interface GameBoardProps {
  matchId: string;
}

export function GameBoard({ matchId }: GameBoardProps) {
  const { user } = useAuthentication();
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);

  const { data: match, isLoading: isLoadingMatch } = useMatch(matchId);
  const { mergeMatch, deleteMatch } = useMatchesActions();

  const [state, dispatch] = useReducer(gameReducer, null, () => ({} as GameState));
  const localUpdateRef = useRef(false);

  // Effect to sync remote state (from the data provider) to local reducer state.
  useEffect(() => {
    if (match && user) {
      if (match.status === 'PLAYING' && !match.gameState && user.uid === match.player1Id) {
        if (!match.player2Id) {
          return;
        }

        const player1: Player = {
          id: match.player1Id,
          name: user.displayName || `Jugador ${user.uid.substring(0, 5)}`,
          hand: [],
          discardPile: [],
        };
        const player2: Player = {
          id: match.player2Id,
          name: `Jugador ${match.player2Id.substring(0, 5)}`,
          hand: [],
          discardPile: [],
        };
        const initialState = getInitialGameState([player1, player2]);
        localUpdateRef.current = true;
        void mergeMatch(matchId, { gameState: initialState });
      } else if (match.gameState) {
        const isPlayerInGame = match.gameState.players.some((p) => p.id === user.uid);
        if (isPlayerInGame && !localUpdateRef.current && !isEqual(state, match.gameState)) {
          dispatch({ type: 'SET_GAME_STATE', payload: match.gameState });
        }
        if (localUpdateRef.current) {
          localUpdateRef.current = false;
        }
      }
    }
  }, [match, user, mergeMatch, matchId, state]);

  // Effect to sync local state changes back to the data provider.
  useEffect(() => {
    if (!state.phase || !user || !match || !state.players?.some((p) => p.id === user.uid)) {
      return;
    }

    if (match.gameState && isEqual(state, match.gameState)) {
      return;
    }

    localUpdateRef.current = true;
    const updateData = {
      gameState: state,
      status: state.phase === 'GAME_OVER' ? 'GAME_OVER' : ('PLAYING' as const),
    } satisfies Partial<Omit<Match, 'id'>>;

    void mergeMatch(matchId, updateData);
  }, [state, user, match, mergeMatch, matchId]);

  const handleCancelMatch = useCallback(async () => {
    if (!matchId) return;
    setIsCancelling(true);
    try {
      await deleteMatch(matchId);
      router.push('/');
    } catch (e) {
      console.error('Error cancelling match', e);
      setIsCancelling(false);
    }
  }, [deleteMatch, matchId, router]);

  const handlePlayCard = useCallback((handIndex: number, isBlind: boolean) => {
    dispatch({ type: 'PLAY_CARD', payload: { handIndex, isBlind } });
  }, []);

  const handleEndTurn = useCallback(() => {
    dispatch({ type: 'END_TURN' });
  }, []);

  const handleNextRound = useCallback(() => {
    dispatch({ type: 'START_NEXT_ROUND' });
  }, []);

  const handleRestart = useCallback(() => {
    dispatch({ type: 'RESTART_GAME' });
  }, []);

  const currentUserId = user?.uid ?? null;
  const { self, opponent } = useMemo(() => {
    const players = state?.players ?? [];
    return {
      self: currentUserId ? players.find((p) => p.id === currentUserId) : undefined,
      opponent: currentUserId ? players.find((p) => p.id !== currentUserId) : undefined,
    };
  }, [state?.players, currentUserId]);

  if (isLoadingMatch || !user) {
    return <GameLoader />;
  }

  if (!match) {
    return (
      <div className="w-full max-w-2xl mx-auto flex items-center justify-center min-h-screen">
        <Card>
          <CardHeader>
            <CardTitle>Error de Partida</CardTitle>
            <CardDescription>
              No se pudo encontrar la partida. Puede que haya sido cancelada o que el enlace sea incorrecto.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => router.push('/')} className="w-full">
              Volver al Lobby
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (match.status === 'LOBBY') {
    return (
      <div className="w-full max-w-2xl mx-auto flex items-center justify-center min-h-screen">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="animate-spin" /> Esperando Oponente
            </CardTitle>
            <CardDescription>La partida comenzará cuando otro jugador se una.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {match.isPublic ? (
              <p>Esta es una partida pública. Un jugador puede unirse en cualquier momento.</p>
            ) : (
              <div>
                <p>Esta es una partida privada. Comparte el código para que se una tu amigo:</p>
                <div className="text-2xl font-bold tracking-widest bg-muted rounded-md p-4 text-center my-2">
                  {match.joinCode}
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              onClick={handleCancelMatch}
              disabled={isCancelling || match.player1Id !== user.uid}
              className="w-full"
            >
              {isCancelling ? <Loader2 className="animate-spin" /> : 'Cancelar Partida'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!state || !state.phase) {
    return <GameLoader />;
  }

  if (!self || !opponent) {
    return (
      <div className="flex justify-center items-center h-full text-center text-muted-foreground">
        <p>Error: No se pudieron cargar los datos de los jugadores. Puede que no formes parte de esta partida.</p>
      </div>
    );
  }

  const isMyTurn = state.players[state.currentPlayerIndex]?.id === self.id;
  const canPlay = isMyTurn && state.turnState === 'PLAYING' && state.playedCardsThisTurn < 3;
  const isRoundOver = state.turnState === 'ROUND_OVER';

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-4">
      <GameInfoPanel state={state} />

      <OpponentHand player={opponent} isCurrentPlayer={!isMyTurn} />

      <CenterRow cards={state.centerRow} />

      <PlayerHand player={self} onPlayCard={handlePlayCard} isCurrentPlayer={isMyTurn} canPlay={canPlay} />

      <ActionPanel state={state} onEndTurn={handleEndTurn} isMyTurn={isMyTurn} player={self} />

      {isRoundOver && <RoundResultToast state={state} onNextRound={handleNextRound} currentUserId={user.uid} />}

      <EndGameDialog state={state} onRestart={handleRestart} />
    </div>
  );
}
