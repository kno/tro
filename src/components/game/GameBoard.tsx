'use client';
import { useReducer, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
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
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { Match, GameState } from '@/lib/types';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

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
  
  const matchRef = useMemoFirebase(() => 
    doc(firestore, 'matches', matchId),
    [firestore, matchId]
  );

  const { data: match, isLoading: isLoadingMatch } = useDoc<Match>(matchRef);

  const [state, dispatch] = useReducer(gameReducer, {} as GameState);

  // Effect to sync remote match state to local reducer
  useEffect(() => {
    if (match && match.gameState) {
      dispatch({ type: 'SET_GAME_STATE', payload: match.gameState });
    }
  }, [match]);
  
  // Effect to sync local state back to Firestore
  useEffect(() => {
    // Only run if the state is initialized and the user is a player
    if (!state.phase || !user || !state.players.find(p => p.id === user.uid) || !matchRef) return;

    // Determine if the current user is the one who should be taking action
    const isCurrentUserTurn = state.players[state.currentPlayerIndex]?.id === user.uid;
    const isRoundOver = state.turnState === 'ROUND_OVER';
    
    // Allow update if it's the current user's turn, or if the round just ended (to sync result)
    if (isCurrentUserTurn || isRoundOver) {
        setDocumentNonBlocking(matchRef, { 
            gameState: state,
            status: state.phase === 'GAME_OVER' ? 'GAME_OVER' : 'PLAYING',
            updatedAt: serverTimestamp() 
        }, { merge: true });
    }
  }, [state, matchRef, user]);


  if (isLoadingMatch || !state.phase) {
    return <GameLoader />;
  }

  if (match?.status === 'LOBBY') {
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
            </Card>
        </div>
    )
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
    if (state.players.length === 2) {
      const newGameState = getInitialGameState(state.players);
      dispatch({ type: 'SET_GAME_STATE', payload: newGameState });
    }
  };

  const self = state.players.find(p => p.id === user?.uid);
  const opponent = state.players.find(p => p.id !== user?.uid);
  
  if (!self || !opponent) {
    return <p>Error: No se pudieron cargar los datos de los jugadores.</p>;
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
      />
      
      <AnimatePresence>
        {state.turnState === 'ROUND_OVER' && <RoundResultToast state={state} onNextRound={handleNextRound} currentUserId={user!.uid} />}
      </AnimatePresence>
      
      <EndGameDialog state={state} onRestart={handleRestart} />
    </div>
  );
}
