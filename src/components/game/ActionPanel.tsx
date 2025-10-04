import type { GameState, Player } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card as UICard, CardContent } from '@/components/ui/card';

interface ActionPanelProps {
  state: GameState;
  onEndTurn: () => void;
  isMyTurn: boolean;
  player: Player;
}

export function ActionPanel({ state, onEndTurn, isMyTurn, player }: ActionPanelProps) {
  const { turnState, playedCardsThisTurn } = state;
  const canEndTurn = isMyTurn && turnState === 'PLAYING' && playedCardsThisTurn > 0;
  
  return (
    <UICard className="mt-4">
      <CardContent className="p-4 flex flex-wrap items-center justify-center gap-4">
        <Button 
          onClick={onEndTurn} 
          disabled={!canEndTurn}
          variant="secondary"
        >
          Terminar Turno
        </Button>
      </CardContent>
    </UICard>
  );
}
