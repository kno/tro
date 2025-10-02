
import type { GameState } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, ShieldAlert } from 'lucide-react';
import { useUser } from '@/firebase';

interface RoundResultToastProps {
  state: GameState;
  onNextRound: () => void;
  currentUserId: string;
}

export function RoundResultToast({ state, onNextRound, currentUserId }: RoundResultToastProps) {
  if (!state.roundEndReason || state.turnState !== 'ROUND_OVER') return null;
  
  const { roundEndReason, lastActionLog, players, currentPlayerIndex } = state;
  
  let winnerIndex: number;
  let nextPlayerToActIndex: number;

  if (state.roundEndReason === 'RAINBOW_COMPLETE') {
    winnerIndex = state.currentPlayerIndex;
    nextPlayerToActIndex = 1 - winnerIndex; // Opponent starts
  } else { // DUPLICATE_COLOR or BLACK_CARD
    winnerIndex = 1 - state.currentPlayerIndex;
    nextPlayerToActIndex = state.currentPlayerIndex; // Loser starts
  }
  const winner = players[winnerIndex];
  const nextPlayerToAct = players[nextPlayerToActIndex];

  const isMyTurnToAct = nextPlayerToAct.id === currentUserId;

  return (
     <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center">
        <Card className="z-50 max-w-sm w-full mx-4">
            <CardHeader className="text-center">
                <div className="mx-auto bg-primary/20 p-3 rounded-full w-fit">
                    {roundEndReason === 'RAINBOW_COMPLETE' ? <Award className="h-8 w-8 text-primary" /> : <ShieldAlert className="h-8 w-8 text-destructive" />}
                </div>
                <CardTitle className="pt-4">{roundEndReason === 'RAINBOW_COMPLETE' ? '¡Arcoíris Completado!' : '¡Ronda Perdida!'}</CardTitle>
                <CardDescription>{winner.name} gana las cartas de la fila.</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
                <p className="text-muted-foreground mb-4">{lastActionLog}</p>
                 {isMyTurnToAct && (
                    <Button onClick={onNextRound} className="w-full">
                        Siguiente Ronda
                    </Button>
                )}
                {!isMyTurnToAct && (
                    <p className="text-sm text-muted-foreground">Esperando a que {nextPlayerToAct.name} inicie la siguiente ronda...</p>
                )}
            </CardContent>
        </Card>
     </div>
  );
}

    