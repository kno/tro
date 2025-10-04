import type { CenterRowCard } from '@/lib/types';
import { GameCard } from './GameCard';
import { Layers } from 'lucide-react';

interface CenterRowProps {
  cards: CenterRowCard[];
  deckCount: number;
}

export function CenterRow({ cards, deckCount }: CenterRowProps) {
  return (
    <div className="relative w-full bg-primary/10 rounded-lg p-4 my-4 min-h-[10vh] md:min-h-[15vh] flex items-center justify-center">
      <div className="absolute top-2 left-2 flex items-center gap-2 bg-background/50 backdrop-blur-sm rounded-full px-3 py-1 text-sm font-semibold text-foreground border">
        <Layers className="w-4 h-4" />
        <span>Mazo: {deckCount}</span>
      </div>
      <div className="flex justify-center items-center gap-2 md:gap-4 flex-wrap">
        {cards.length > 0 ? (
          cards.map((card, index) => (
            <GameCard
              key={`${card.id}-${index}`}
              card={card}
              view="center"
              isFaceUp={card.isFaceUp}
              className="w-20 md:w-28"
            />
          ))
        ) : (
          <p className="text-muted-foreground text-lg">La fila está vacía. ¡Empieza un nuevo arcoíris!</p>
        )}
      </div>
    </div>
  );
}
