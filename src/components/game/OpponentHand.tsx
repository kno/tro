import type { Player } from '@/lib/types';
import { GameCard } from './GameCard';
import { Card, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface OpponentHandProps {
  player: Player;
  isCurrentPlayer: boolean;
}

export function OpponentHand({ player, isCurrentPlayer }: OpponentHandProps) {
  return (
    <Card className={cn("transition-colors p-2", isCurrentPlayer ? "bg-white" : "bg-card/50")}>
       <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <CardTitle className={cn('text-base font-semibold', isCurrentPlayer ? "text-black" : "text-muted-foreground")}>
              {player.name} &ndash; Puntos: {player.discardPile.length}
            </CardTitle>
            <div className="flex justify-center items-start gap-1 md:gap-2 min-h-[10vh]">
              {player.hand.length > 0 ? (
                player.hand.map((card, index) => (
                  <GameCard
                    key={`${card.id}-${index}`}
                    card={card}
                    view="opponent"
                    className="w-16 md:w-24"
                  />
                ))
              ) : (
                <p className="text-muted-foreground text-sm">El oponente no tiene cartas.</p>
              )}
            </div>
       </div>
    </Card>
  );
}
