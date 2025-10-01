import type { GameState } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ActionPanelProps {
  state: GameState;
  onEndTurn: () => void;
}

export function ActionPanel({ state, onEndTurn }: ActionPanelProps) {
  const { turnState, playedCardsThisTurn } = state;
  const isCurrentPlayerTurn = true; // Simplified for local play
  const canEndTurn = isCurrentPlayerTurn && (turnState === 'AWAITING_PLAY' || playedCardsThisTurn > 0);
  
  return (
    <Card className="mt-4">
      <CardContent className="p-4 flex flex-wrap items-center justify-center gap-4">
        <Button 
          onClick={onEndTurn} 
          disabled={!canEndTurn}
          variant="secondary"
        >
          Terminar Turno
        </Button>
      </CardContent>
    </Card>
  );
}
