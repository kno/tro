import type { Player } from '@/lib/types';
import { GameCard } from './GameCard';
import { Card, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface PlayerHandProps {
  player: Player;
  onPlayCard: (handIndex: number, isBlind: boolean) => void;
  isCurrentPlayer: boolean;
  canPlay: boolean;
}

export function PlayerHand({ player, onPlayCard, isCurrentPlayer, canPlay }: PlayerHandProps) {
  return (
    <Card className={cn("transition-colors p-2", isCurrentPlayer ? "bg-white" : "bg-card/50")}>
       <div className="flex flex-wrap items-center justify-start gap-x-4 gap-y-2">
            <CardTitle className={cn('text-base font-semibold', isCurrentPlayer ? "text-black" : "text-muted-foreground")}>
                Tu Mano &ndash; Puntos: {player.discardPile.length}
            </CardTitle>
            <div className="flex justify-center items-end gap-1 md:gap-2 min-h-[10vh]">
            {player.hand.length > 0 ? (
                player.hand.map((card, index) => (
                <GameCard
                    key={`${card.id}-${index}`}
                    card={card}
                    view="player"
                    onClick={() => onPlayCard(index, false)}
                    onPlayBlind={() => onPlayCard(index, true)}
                    className="w-16 md:w-24"
                    isPlayable={isCurrentPlayer && canPlay}
                />
                ))
            ) : (
                <p className="text-muted-foreground text-sm">No tienes cartas.</p>
            )}
            </div>
       </div>
    </Card>
  );
}
