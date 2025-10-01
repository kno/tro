import type { GameState } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, ShieldAlert } from 'lucide-react';

interface RoundResultToastProps {
  state: GameState;
  onNextRound: () => void;
}

export function RoundResultToast({ state, onNextRound }: RoundResultToastProps) {
  if (!state.roundEndReason) return null;
  
  const { roundEndReason, lastActionLog, players, currentPlayerIndex } = state;
  const winnerIndex = roundEndReason === 'RAINBOW_COMPLETE' ? currentPlayerIndex : 1 - currentPlayerIndex;
  const winner = players[winnerIndex];

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
                <Button onClick={onNextRound} className="w-full">
                    Siguiente Ronda
                </Button>
            </CardContent>
        </Card>
     </div>
  );
}
