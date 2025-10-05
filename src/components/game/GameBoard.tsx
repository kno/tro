// src/app/game/GameBoard.tsx
'use client';
import { useReducer, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createGameReducer, getInitialGameState } from '@/lib/game-logic';
import { PlayerHand } from './PlayerHand';
import { OpponentHand } from './OpponentHand';
import { CenterRow } from './CenterRow';
import { ActionPanel } from './ActionPanel';
import { EndGameDialog } from './EndGameDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useDoc, useFirestore, useUser, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, serverTimestamp, deleteDoc, updateDoc } from 'firebase/firestore';
import type { Match, GameState, Player } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { useRouter } from 'next/navigation';
import { isEqual } from 'lodash';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '../ui/toast';
import { Award, ShieldAlert } from 'lucide-react';

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
  const { toast, dismiss } = useToast();
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
  const roundEndToastId = useRef<string | null>(null);

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
  
  const handleFlipCard = useCallback((centerRowIndex: number) => {
    dispatch({ type: 'FLIP_CARD', payload: { centerRowIndex }});
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
  
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
  
    if (state.turnState === 'ROUND_OVER' && state.roundEndReason && user && !roundEndToastId.current) {
        const { roundEndReason, players, currentPlayerIndex } = state;
        
        let winnerIndex: number;
        let nextPlayerToActIndex: number;

        if (roundEndReason === 'RAINBOW_COMPLETE') {
            winnerIndex = currentPlayerIndex;
            nextPlayerToActIndex = 1 - winnerIndex;
        } else {
            winnerIndex = 1 - currentPlayerIndex;
            nextPlayerToActIndex = currentPlayerIndex;
        }

        const winner = players[winnerIndex];
        const nextPlayerToAct = players[nextPlayerToActIndex];
        const isMyTurnToAct = nextPlayerToAct.id === user.uid;

        const title = roundEndReason === 'RAINBOW_COMPLETE' 
            ? '¡Arcoíris Completado!' 
            : '¡Ronda Perdida!';

        const description = `${winner?.name || 'Un jugador'} gana las cartas de la fila. ${!isMyTurnToAct ? `Esperando a ${nextPlayerToAct?.name || 'oponente'}...` : ''}`;

        const { id } = toast({
            title: (
                <div className="flex items-center gap-2">
                    {roundEndReason === 'RAINBOW_COMPLETE' ? <Award /> : <ShieldAlert />}
                    {title}
                </div>
            ),
            description: description,
            duration: 5000,
            action: isMyTurnToAct ? (
                <ToastAction altText="Siguiente Ronda" onClick={handleNextRound}>
                    Siguiente Ronda
                </ToastAction>
            ) : undefined,
        });
        roundEndToastId.current = id;
        
        if (isMyTurnToAct) {
            timeoutId = setTimeout(() => {
                if (roundEndToastId.current === id) { // Only act if this toast is still the active one
                    handleNextRound();
                }
            }, 5000);
        }
    }
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (state.turnState !== 'ROUND_OVER' && roundEndToastId.current) {
        dismiss(roundEndToastId.current);
        roundEndToastId.current = null;
      }
    }
  }, [state.turnState, state.roundEndReason, state.currentPlayerIndex, user, toast, handleNextRound, dismiss]);


  const currentUserId = user?.uid ?? null;
  const { self, opponent } = useMemo(() => {
    if (!state?.players || state.players.length < 2) {
      return { self: undefined, opponent: undefined };
    }
    const players = state.players;
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
  const isRoundOver = state.turnState === 'ROUND_OVER';

  const canPlayCard = isMyTurn && !isRoundOver && state.playedCardsThisTurn < 3 && (state.lastActionInTurn === 'NONE' || state.lastActionInTurn === 'FLIP');
  const canFlipCard = isMyTurn && !isRoundOver && state.playedCardsThisTurn < 3 && state.lastActionInTurn !== 'FLIP';

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-4">
      <OpponentHand player={opponent} isCurrentPlayer={!isMyTurn} />

      <CenterRow 
        cards={state.centerRow} 
        deckCount={state.deck.length}
        onFlipCard={handleFlipCard}
        canFlip={canFlipCard}
      />

      <PlayerHand 
        player={self} 
        onPlayCard={handlePlayCard} 
        isCurrentPlayer={isMyTurn} 
        canPlay={canPlayCard}
      />
      
      <ActionPanel 
        state={state} 
        onEndTurn={handleEndTurn}
        isMyTurn={isMyTurn}
        player={self}
      />
      
      <EndGameDialog state={state} onRestart={handleRestart} />
    </div>
  );
}
