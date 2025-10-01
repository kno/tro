import type { Player } from '@/lib/types';
import { GameCard } from './GameCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface PlayerHandProps {
  player: Player;
  onPlayCard: (handIndex: number, isBlind: boolean) => void;
  isCurrentPlayer: boolean;
  canPlay: boolean;
}

export function PlayerHand({ player, onPlayCard, isCurrentPlayer, canPlay }: PlayerHandProps) {
  return (
    <Card className="bg-card/50">
      <CardHeader>
        <CardTitle>{player.name} {isCurrentPlayer && "(Tu Turno)"}</CardTitle>
        <CardDescription>Tu mano</CardDescription>
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
