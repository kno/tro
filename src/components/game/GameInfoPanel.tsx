import type { GameState } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Hourglass, Layers, Trash2 } from 'lucide-react';

interface GameInfoPanelProps {
  state: GameState;
}

export function GameInfoPanel({ state }: GameInfoPanelProps) {
  const { players, deck, turnTimer, lastActionLog, currentPlayerIndex } = state;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Jugadores</CardTitle>
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-lg font-bold">{players[0].name}: {players[0].discardPile.length} cartas</div>
          <div className="text-lg font-bold">{players[1].name}: {players[1].discardPile.length} cartas</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Mazo</CardTitle>
          <Layers className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{deck.length}</div>
          <p className="text-xs text-muted-foreground">cartas restantes</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Turno de {players[currentPlayerIndex].name}</CardTitle>
           <Hourglass className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{turnTimer}s</div>
          <Progress value={(turnTimer / 60) * 100} className="w-full mt-2" />
        </CardContent>
      </Card>

      <Card className="md:col-span-3">
        <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Registro de acciones</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-sm text-muted-foreground italic">{lastActionLog}</p>
        </CardContent>
      </Card>
    </div>
  );
}
