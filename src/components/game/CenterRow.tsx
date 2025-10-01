import type { CenterRowCard } from '@/lib/types';
import { GameCard } from './GameCard';

interface CenterRowProps {
  cards: CenterRowCard[];
  onFlipCard: (centerIndex: number) => void;
  canFlip: boolean;
}

export function CenterRow({ cards, onFlipCard, canFlip }: CenterRowProps) {
  return (
    <div className="w-full bg-primary/10 rounded-lg p-4 my-4 min-h-[20vh] md:min-h-[25vh] flex items-center justify-center">
      <div className="flex justify-center items-center gap-2 md:gap-4 flex-wrap">
        {cards.length > 0 ? (
          cards.map((card, index) => (
            <GameCard
              key={`${card.id}-${index}`}
              card={card}
              view="center"
              isFaceUp={card.isFaceUp}
              onClick={() => onFlipCard(index)}
              className="w-20 md:w-28"
              isPlayable={canFlip}
            />
          ))
        ) : (
          <p className="text-muted-foreground text-lg">La fila está vacía. ¡Empieza un nuevo arcoíris!</p>
        )}
      </div>
    </div>
  );
}
