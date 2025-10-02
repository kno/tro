'use client';
import { useReducer, useEffect, useState, useRef } from 'react';
import { gameReducer, getInitialGameState } from '@/lib/game-logic';
import { PlayerHand } from './PlayerHand';
import { OpponentHand } from './OpponentHand';
import { CenterRow } from './CenterRow';
import { GameInfoPanel } from './GameInfoPanel';
import { ActionPanel } from './ActionPanel';
import { EndGameDialog } from './EndGameDialog';
import { RoundResultToast } from './RoundResultToast';
import { Skeleton } from '@/components/ui/skeleton';
import { useDoc, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { doc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import type { Match, GameState, Player } from '@/lib/types';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { useRouter } from 'next/navigation';
import { FirestorePermissionError, errorEmitter } from '@/firebase';
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
  
  const matchRef = useMemoFirebase(() => 
    firestore ? doc(firestore, 'matches', matchId) : null,
    [firestore, matchId]
  );

  const { data: match, isLoading: isLoadingMatch } = useDoc<Match>(matchRef);

  const [state, dispatch] = useReducer(gameReducer, {} as GameState);
  
  const localUpdateRef = useRef(false);

  useEffect(() => {
    if (match && user) {
      if (match.status === 'PLAYING' && !match.gameState && user.uid === match.player1Id) {
        // Player 1 initializes the game state when player 2 joins.
        const player1: Player = { id: match.player1Id, name: user.displayName || `Jugador ${user.uid.substring(0,5)}`, hand: [], discardPile: [] };
        // We need player2's name. For now, use a placeholder.
        // In a real app, you might fetch a user profile for player2Id.
        const player2: Player = { id: match.player2Id, name: `Jugador ${match.player2Id.substring(0,5)}`, hand: [], discardPile: [] };
        const initialState = getInitialGameState([player1, player2]);
        localUpdateRef.current = true;
        setDocumentNonBlocking(matchRef!, { gameState: initialState }, { merge: true });
      } else if (match.gameState) {
        // Sync remote state to local state, but only if they are different.
        // This check prevents infinite loops.
        const isPlayerInGame = match.gameState.players.some(p => p.id === user.uid);
        if (isPlayerInGame && !localUpdateRef.current && !isEqual(state, match.gameState)) {
            dispatch({ type: 'SET_GAME_STATE', payload: match.gameState });
        }
        if (localUpdateRef.current) {
            localUpdateRef.current = false;
        }
      }
    }
  }, [match, user, matchRef, state]);
  
  // This effect synchronizes local state changes up to Firestore.
  useEffect(() => {
    // Don't run if state isn't initialized, user is not loaded, or refs are missing
    if (!state.phase || !user || !state.players?.find(p => p.id === user.uid) || !matchRef) return;
    
    // Avoid writing back the state we just received from Firestore
    if (match && isEqual(state, match.gameState)) return;

    const isMyTurn = state.players[state.currentPlayerIndex]?.id === user.uid;
    const isRoundOver = state.turnState === 'ROUND_OVER';
    
    // Only the current player or the player who ended the round should update the state
    if (isMyTurn || isRoundOver) {
      localUpdateRef.current = true;
      const updateData = { 
            gameState: state,
            status: state.phase === 'GAME_OVER' ? 'GAME_OVER' : 'PLAYING' as const,
            updatedAt: serverTimestamp() 
      };
      setDocumentNonBlocking(matchRef, updateData, { merge: true });
    }
  }, [state, matchRef, user, match]);

  const handleCancelMatch = async () => {
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
  };

  // --- Render Logic ---

  if (isLoadingMatch || !user) {
    return <GameLoader />;
  }

  if (!match) {
    return (
        <div className="w-full max-w-2xl mx-auto">
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
        <div className="w-full max-w-2xl mx-auto">
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
    )
  }
  
  // After handling LOBBY, if gameState isn't ready, show loader.
  if (!state.phase || !match.gameState) {
    return <GameLoader />;
  }


  const handlePlayCard = (handIndex: number, isBlind: boolean) => {
    dispatch({ type: 'PLAY_CARD', payload: { handIndex, isBlind } });
  };
  
  const handleEndTurn = () => {
    dispatch({ type: 'END_TURN' });
  };
  
  const handleNextRound = () => {
    dispatch({ type: 'START_NEXT_ROUND' });
  };
  
  const handleRestart = () => {
    dispatch({ type: 'RESTART_GAME' });
  };

  const self = state.players.find(p => p.id === user.uid);
  const opponent = state.players.find(p => p.id !== user.uid);
  
  if (!self || !opponent) {
    return (
       <div className="flex justify-center items-center h-full text-center text-muted-foreground">
          <p>Error: No se pudieron cargar los datos de los jugadores. Puede que no formes parte de esta partida.</p>
      </div>
    );
  }

  const isMyTurn = state.players[state.currentPlayerIndex]?.id === self.id;
  const canPlay = isMyTurn && state.turnState === 'PLAYING' && state.playedCardsThisTurn < 3;

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-4">
      <GameInfoPanel state={state} />

      <OpponentHand player={opponent} isCurrentPlayer={!isMyTurn} />

      <CenterRow cards={state.centerRow} />

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
      
      {state.turnState === 'ROUND_OVER' && <RoundResultToast state={state} onNextRound={handleNextRound} currentUserId={user.uid} />}
      
      <EndGameDialog state={state} onRestart={handleRestart} />
    </div>
  );
}
    