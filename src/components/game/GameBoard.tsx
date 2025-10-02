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
  console.log(`[GameBoard] Render Start. Match ID: ${matchId}`);
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);
  
  const matchRef = useMemoFirebase(() => {
    console.log('[GameBoard] Memoizing matchRef.');
    return firestore ? doc(firestore, 'matches', matchId) : null;
  },[firestore, matchId]);

  const { data: match, isLoading: isLoadingMatch } = useDoc<Match>(matchRef);

  const [state, dispatch] = useReducer(gameReducer, {} as GameState);
  
  const localUpdateRef = useRef(false);

  // Effect to sync remote state (from Firestore) to local state (useReducer)
  useEffect(() => {
    console.log('[GameBoard] Remote-Sync-Effect: Running.');
    console.log('[GameBoard] Remote-Sync-Effect: Current match data:', match);
    console.log('[GameBoard] Remote-Sync-Effect: Current user:', user);

    if (match && user) {
      if (match.status === 'PLAYING' && !match.gameState && user.uid === match.player1Id) {
        console.log('[GameBoard] Remote-Sync-Effect: Player 1 is initializing game state.');
        const player1: Player = { id: match.player1Id, name: user.displayName || `Jugador ${user.uid.substring(0,5)}`, hand: [], discardPile: [] };
        const player2: Player = { id: match.player2Id, name: `Jugador ${match.player2Id.substring(0,5)}`, hand: [], discardPile: [] };
        const initialState = getInitialGameState([player1, player2]);
        localUpdateRef.current = true;
        setDocumentNonBlocking(matchRef!, { gameState: initialState }, { merge: true });
      } else if (match.gameState) {
        const isPlayerInGame = match.gameState.players.some(p => p.id === user.uid);
        if (isPlayerInGame && !localUpdateRef.current && !isEqual(state, match.gameState)) {
            console.log('[GameBoard] Remote-Sync-Effect: Syncing remote gameState to local state.');
            dispatch({ type: 'SET_GAME_STATE', payload: match.gameState });
        }
        if (localUpdateRef.current) {
            console.log('[GameBoard] Remote-Sync-Effect: Clearing localUpdateRef flag.');
            localUpdateRef.current = false;
        }
      }
    } else {
       console.log('[GameBoard] Remote-Sync-Effect: Skipping due to no match or user.');
    }
  }, [match, user, matchRef, state]);
  
  // Effect to sync local state changes up to Firestore.
  useEffect(() => {
    console.log('[GameBoard] Local-Sync-Effect: Running.');
    console.log('[GameBoard] Local-Sync-Effect: Current local state:', state);
    if (!state.phase || !user || !state.players?.find(p => p.id === user.uid) || !matchRef) {
      console.log('[GameBoard] Local-Sync-Effect: Skipping, state not ready.');
      return;
    };
    
    if (match && isEqual(state, match.gameState)) {
      console.log('[GameBoard] Local-Sync-Effect: Skipping, local and remote state are identical.');
      return;
    }

    const isMyTurn = state.players[state.currentPlayerIndex]?.id === user.uid;
    const isRoundOver = state.turnState === 'ROUND_OVER';
    
    if (isMyTurn || isRoundOver) {
      console.log('[GameBoard] Local-Sync-Effect: Updating Firestore with local state.');
      localUpdateRef.current = true;
      const updateData = { 
            gameState: state,
            status: state.phase === 'GAME_OVER' ? 'GAME_OVER' : 'PLAYING' as const,
            updatedAt: serverTimestamp() 
      };
      setDocumentNonBlocking(matchRef, updateData, { merge: true });
    } else {
       console.log('[GameBoard] Local-Sync-Effect: Skipping, not my turn or round not over.');
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
  console.log(`[GameBoard] Render Logic: isLoadingMatch=${isLoadingMatch}, user=${!!user}, match=${!!match}`);

  if (isLoadingMatch || !user) {
    console.log("[GameBoard] Render: Showing GameLoader (isLoadingMatch or !user).");
    return <GameLoader />;
  }

  if (!match) {
    console.log("[GameBoard] Render: Showing 'Match Not Found' error.");
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
    console.log("[GameBoard] Render: Showing 'Lobby / Waiting for Opponent' screen.");
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
  
  if (!state.phase || !match.gameState) {
    console.log("[GameBoard] Render: Showing GameLoader (state not initialized or no gameState).");
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
    console.log("[GameBoard] Render: Showing 'Player Data Error'.");
    return (
       <div className="flex justify-center items-center h-full text-center text-muted-foreground">
          <p>Error: No se pudieron cargar los datos de los jugadores. Puede que no formes parte de esta partida.</p>
      </div>
    );
  }

  const isMyTurn = state.players[state.currentPlayerIndex]?.id === self.id;
  const canPlay = isMyTurn && state.turnState === 'PLAYING' && state.playedCardsThisTurn < 3;
  console.log(`[GameBoard] Render: Game board ready. isMyTurn=${isMyTurn}`);

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
    