import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { GameState } from "@/lib/types";
import { Award, Users } from "lucide-react";

interface EndGameDialogProps {
    state: GameState;
    onRestart: () => void;
}

export function EndGameDialog({ state, onRestart }: EndGameDialogProps) {
    if (state.phase !== 'GAME_OVER' || state.players.length < 2) {
        return null;
    }

    const winner = state.players.find(p => p.id === state.gameWinnerId);

    return (
        <AlertDialog open={true}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        {state.isTie ? <Users /> : <Award />}
                        ¡Fin de la Partida!
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-lg pt-4">
                        {state.isTie ? "Ha sido un empate." : `${winner?.name} ha ganado la partida.`}
                    </AlertDialogDescription>
                    <div className="pt-2 text-base">
                        <p>Puntuación Final:</p>
                        <p className="font-semibold">{state.players[0].name}: {state.players[0].discardPile.length} cartas</p>
                        <p className="font-semibold">{state.players[1].name}: {state.players[1].discardPile.length} cartas</p>
                    </div>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction onClick={onRestart}>
                        {state.isTie ? "Jugar Desempate" : "Jugar Otra Vez"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
