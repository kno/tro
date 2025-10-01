import type { GameState } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Card, CardContent } from '@/components/ui/card';

interface ActionPanelProps {
  state: GameState;
  onEndTurn: () => void;
  onPlayCard: (handIndex: number, isBlind: boolean) => void;
  selectedCardIndex: number | null;
  setSelectedCardIndex: (index: number | null) => void;
}

export function ActionPanel({ state, onEndTurn, onPlayCard, selectedCardIndex, setSelectedCardIndex }: ActionPanelProps) {
  const { turnState, playedCardsThisTurn } = state;
  const isCurrentPlayerTurn = true; // Simplified for local play
  const canPlay = isCurrentPlayerTurn && turnState === 'AWAITING_PLAY' && playedCardsThisTurn < 3;
  
  const handleConfirmPlay = (isBlind: boolean) => {
    if (selectedCardIndex !== null) {
      onPlayCard(selectedCardIndex, isBlind);
    }
    setSelectedCardIndex(null);
  };
  
  return (
    <Card className="mt-4">
      <CardContent className="p-4 flex flex-wrap items-center justify-center gap-4">
        <Button 
          onClick={onEndTurn} 
          disabled={!canPlay && playedCardsThisTurn === 0}
          variant="secondary"
        >
          Terminar Turno
        </Button>

        <AlertDialog open={selectedCardIndex !== null} onOpenChange={(isOpen) => !isOpen && setSelectedCardIndex(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Cómo quieres jugar esta carta?</AlertDialogTitle>
              <AlertDialogDescription>
                Normal: Muestras el lado que ves.
                <br />
                A Ciegas: Muestras el lado que no ves (el que ve tu oponente).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setSelectedCardIndex(null)}>Cancelar</AlertDialogCancel>
              <Button variant="outline" onClick={() => handleConfirmPlay(false)}>Jugar Normal</Button>
              <Button onClick={() => handleConfirmPlay(true)}>Jugar a Ciegas</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </CardContent>
    </Card>
  );
}
