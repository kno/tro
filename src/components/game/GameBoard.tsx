// src/components/game/GameBoard.tsx
'use client';
import { useReducer, useEffect, useState, useCallback, useMemo } from 'react';
import { createGameReducer, getInitialGameState } from '@/lib/game-logic';
import { PlayerHand } from './PlayerHand';
import { OpponentHand } from './OpponentHand';
import { CenterRow } from './CenterRow';
import { ActionPanel } from './ActionPanel';
import { EndGameDialog } from './EndGameDialog';
import { RoundResultToast } from './RoundResultToast';
import { Skeleton } from '@/components/ui/skeleton';
import { useDoc, useFirestore, useUser, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, serverTimestamp, deleteDoc, updateDoc } from 'firebase/firestore';
import type { Match, GameState, Player } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { useRouter } from 'next/navigation';
import { isEqual } from 'lodash';
import { Button } from '@/components/ui/button';

function GameLoader() {
  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-4 p-4">
      <Skeleton className="h-24" />
      <Skeleton className="h-48" />
      <Skeleton className="h-48" />
    </div>
  )
}

interface GameBoardProps {
  matchId: string;
}

export function GameBoard({ matchId }: GameBoardProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);

  const matchRef = useMemoFirebase(() => {
    return firestore ? doc(firestore, 'matches', matchId) : null;
  }, [firestore, matchId]);
  
  const { data: match, isLoading: isLoadingMatch } = useDoc<Match>(matchRef);

  const gameReducer = useMemo(() => {
    // The reducer needs the matchRef to perform Firestore updates.
    return createGameReducer(matchRef, user?.uid ?? null);
  }, [matchRef, user?.uid]);

  // IMPORTANT: Initialize reducer with a valid state structure, even if it's a dummy one.
  const [state, dispatch] = useReducer(gameReducer, getInitialGameState([]));

  // This effect syncs remote state from Firestore to the local reducer.
  useEffect(() => {
    if (match?.gameState && !isEqual(state, match.gameState)) {
        dispatch({ type: 'SET_GAME_STATE', payload: match.gameState });
    }
    // DO NOT add `state` to dependencies. It will cause an infinite loop.
  }, [match?.gameState, dispatch]); // eslint-disable-line react-hooks/exhaustive-deps


  // EFFECT FOR PLAYER 1 TO INITIALIZE THE GAME STATE
  // This runs independently and directly updates Firestore, breaking the deadlock.
  useEffect(() => {
    if (
      match && user && matchRef &&
      match.status === 'PLAYING' &&
      !match.gameState && // The crucial condition
      user.uid === match.player1Id // Only Player 1 should do this
    ) {
        console.log("Player 1 is initializing the game state directly via updateDoc...");
        
        const player1: Player = {
          id: match.player1Id,
          name: `Jugador 1`,
          hand: [],
          discardPile: [],
        };
        const player2: Player = {
          id: match.player2Id,
          name: `Jugador 2`,
          hand: [],
          discardPile: [],
        };
        const initialState = getInitialGameState([player1, player2]);
        
        const updateData = {
          gameState: initialState,
          updatedAt: serverTimestamp()
        };

        updateDoc(matchRef, updateData).catch(e => {
            console.error("Failed to initialize game state:", e);
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
  }, [match, user, matchRef]); // Dependencies are the things needed to make the decision.


  const handleCancelMatch = useCallback(async () => {
    if (!matchRef) return;
    setIsCancelling(true);
    deleteDoc(matchRef)
      .then(() => {
        router.push('/');
      })
      .catch(e => {
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({
            path: `matches/${matchId}`,
            operation: 'delete',
          })
        );
        setIsCancelling(false);
      });
  }, [matchRef, router, matchId]);

  const handlePlayCard = useCallback((handIndex: number, isBlind: boolean) => {
    dispatch({ type: 'PLAY_CARD', payload: { handIndex, isBlind } });
  }, [dispatch]);

  const handleEndTurn = useCallback(() => {
    dispatch({ type: 'END_TURN' });
  }, [dispatch]);

  const handleNextRound = useCallback(() => {
    dispatch({ type: 'START_NEXT_ROUND' });
  }, [dispatch]);

  const handleRestart = useCallback(() => {
    dispatch({ type: 'RESTART_GAME' });
  }, [dispatch]);

  const currentUserId = user?.uid ?? null;
  const { self, opponent } = useMemo(() => {
    const players = state?.players ?? [];
    return {
      self: currentUserId ? players.find(p => p.id === currentUserId) : undefined,
      opponent: currentUserId ? players.find(p => p.id !== currentUserId) : undefined,
    };
  }, [state?.players, currentUserId]);


  // Primary loading condition.
  // Show loader if we're fetching the match, or if the match is in PLAYING state but gameState hasn't been created yet.
  if (isLoadingMatch || !user || !match || (match.status === 'PLAYING' && !match.gameState)) {
    return <GameLoader />;
  }
  
  if (!match) {
    return (
        <div className="w-full max-w-2xl mx-auto flex items-center justify-center min-h-screen">
            <Card>
                <CardHeader>
                    <CardTitle>Error de Partida</CardTitle>
                    <CardDescription>No se pudo encontrar la partida. Puede que haya sido cancelada o que el enlace sea incorrecto.</CardDescription>
                </CardHeader>
                <CardFooter>
                    <Button onClick={() => router.push('/')} className="w-full">Volver al Lobby</Button>
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
                    <CardTitle className="flex items-center gap-2"><Loader2 className="animate-spin" /> Esperando Oponente</CardTitle>
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
                    <Button variant="outline" onClick={handleCancelMatch} disabled={isCancelling || match.player1Id !== user?.uid} className="w-full">
                        {isCancelling ? <Loader2 className="animate-spin" /> : "Cancelar Partida"}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
  }

  // If we have a match but no game state yet (e.g. P2 just joined, P1 is creating state), show loader.
  if (!state || !state.phase) {
    return <GameLoader />;
  }

  if (!self || !opponent) {
    return (
       <div className="flex justify-center items-center h-full text-center text-muted-foreground p-4">
          <p>Error: No se pudieron cargar los datos de los jugadores. Puede que no formes parte de esta partida.</p>
      </div>
    );
  }

  const isMyTurn = state.players[state.currentPlayerIndex]?.id === self.id;
  const canPlay = isMyTurn && state.turnState === 'PLAYING' && state.playedCardsThisTurn < 3;
  const isRoundOver = state.turnState === 'ROUND_OVER';

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-4">
      <OpponentHand player={opponent} isCurrentPlayer={!isMyTurn} />

      <CenterRow cards={state.centerRow} deckCount={state.deck.length} />

      <PlayerHand 
        player={self} 
        onPlayCard={handlePlayCard} 
        isCurrentPlayer={isMyTurn} 
        canPlay={canPlay}
      />
      
      <ActionPanel 
        state={state} 
        onEndTurn={handleEndTurn}
        isMyTurn={isMyTurn}
        player={self}
      />
      
      {isRoundOver && <RoundResultToast state={state} onNextRound={handleNextRound} currentUserId={user.uid} />}
      
      <EndGameDialog state={state} onRestart={handleRestart} />
    </div>
  );
}
