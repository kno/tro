import type { Player } from '@/lib/types';
import { GameCard } from './GameCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface PlayerHandProps {
  player: Player;
  onPlayCard: (handIndex: number, isBlind: boolean) => void;
  isCurrentPlayer: boolean;
  canPlay: boolean;
}

export function PlayerHand({ player, onPlayCard, isCurrentPlayer, canPlay }: PlayerHandProps) {
  return (
    <Card className={cn("transition-colors", isCurrentPlayer ? "bg-card" : "bg-card/50")}>
      <CardHeader className='pb-2 pt-4'>
        <CardTitle className={cn('text-lg', isCurrentPlayer ? "text-card-foreground" : "")}>
            {player.name} - Puntos: {player.discardPile.length}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center items-end gap-2 md:gap-4 min-h-[15vh] md:min-h-[20vh]">
          {player.hand.length > 0 ? (
            player.hand.map((card, index) => (
              <GameCard
                key={`${card.id}-${index}`}
                card={card}
                view="player"
                onClick={() => onPlayCard(index, false)}
                onPlayBlind={() => onPlayCard(index, true)}
                className="w-20 md:w-28"
                isPlayable={isCurrentPlayer && canPlay}
              />
            ))
          ) : (
            <p className="text-muted-foreground">No tienes cartas.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
