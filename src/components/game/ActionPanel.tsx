import type { GameState } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ActionPanelProps {
  state: GameState;
  onEndTurn: () => void;
  isMyTurn: boolean;
}

export function ActionPanel({ state, onEndTurn, isMyTurn }: ActionPanelProps) {
  const { turnState } = state;
  const canEndTurn = isMyTurn && turnState === 'PLAYING';
  
  return (
    <Card className="mt-4">
      <CardContent className="p-4 flex flex-wrap items-center justify-center gap-4">
        <Button 
          onClick={onEndTurn} 
          disabled={!canEndTurn}
          variant="secondary"
        >
          Terminar Turno / Pasar
        </Button>
      </CardContent>
    </Card>
  );
}
