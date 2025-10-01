'use client';
import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useGameLogic } from '@/lib/game-logic';
import { PlayerHand } from './PlayerHand';
import { OpponentHand } from './OpponentHand';
import { CenterRow } from './CenterRow';
import { GameInfoPanel } from './GameInfoPanel';
import { ActionPanel } from './ActionPanel';
import { EndGameDialog } from './EndGameDialog';
import { RoundResultToast } from './RoundResultToast';
import { Skeleton } from '@/components/ui/skeleton';

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

export function GameBoard() {
  const { state, dispatch, isInitialized } = useGameLogic();
  
  if (!isInitialized) {
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

  const player = state.players[0];
  const opponent = state.players[1];
  const isPlayerTurn = state.currentPlayerIndex === 0;

  const canPlay = isPlayerTurn && state.turnState === 'PLAYING' && state.playedCardsThisTurn < 3;

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-4">
      <GameInfoPanel state={state} />

      <OpponentHand player={opponent} isCurrentPlayer={!isPlayerTurn} />

      <CenterRow cards={state.centerRow} />

      <PlayerHand 
        player={player} 
        onPlayCard={handlePlayCard} 
        isCurrentPlayer={isPlayerTurn} 
        canPlay={canPlay}
      />
      
      <ActionPanel 
        state={state} 
        onEndTurn={handleEndTurn} 
      />
      
      <AnimatePresence>
        {state.roundEndReason && <RoundResultToast state={state} onNextRound={handleNextRound} />}
      </AnimatePresence>
      
      <EndGameDialog state={state} onRestart={handleRestart} />
    </div>
  );
}
