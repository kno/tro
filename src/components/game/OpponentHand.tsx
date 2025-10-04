import type { Player } from '@/lib/types';
import { GameCard } from './GameCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface OpponentHandProps {
  player: Player;
  isCurrentPlayer: boolean;
}

export function OpponentHand({ player, isCurrentPlayer }: OpponentHandProps) {
  return (
    <Card className={cn("transition-colors", isCurrentPlayer ? "bg-background" : "bg-card/50")}>
       <CardHeader className='pb-2 pt-4'>
        <CardTitle className={cn('text-lg', isCurrentPlayer ? "text-foreground" : "text-muted-foreground")}>
          {player.name} - Puntos: {player.discardPile.length}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center items-start gap-2 md:gap-4 min-h-[15vh] md:min-h-[20vh]">
          {player.hand.length > 0 ? (
            player.hand.map((card, index) => (
              <GameCard
                key={`${card.id}-${index}`}
                card={card}
                view="opponent"
                className="w-20 md:w-28"
              />
            ))
          ) : (
            <p className="text-muted-foreground">El oponente no tiene cartas.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
