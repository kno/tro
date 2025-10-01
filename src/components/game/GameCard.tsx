import type { Card, Color } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ColorIcon } from '@/components/icons';
import { motion } from 'framer-motion';

const COLOR_STYLES: Record<Color, string> = {
  Red: 'bg-red-500 border-red-700 text-white',
  Orange: 'bg-orange-500 border-orange-700 text-white',
  Yellow: 'bg-yellow-400 border-yellow-600 text-black',
  Green: 'bg-green-500 border-green-700 text-white',
  Blue: 'bg-blue-500 border-blue-700 text-white',
  Indigo: 'bg-indigo-500 border-indigo-700 text-white',
  Violet: 'bg-violet-500 border-violet-700 text-white',
  White: 'bg-gray-100 border-gray-300 text-black',
  Black: 'bg-black border-gray-600 text-white',
};

const CardBack = () => (
    <div className="w-full h-full bg-primary/80 rounded-lg flex items-center justify-center">
        <div className="w-3/4 h-3/4 rounded-md border-2 border-dashed border-primary-foreground/50 flex items-center justify-center">
             <span className="text-2xl font-bold text-primary-foreground/80">?</span>
        </div>
    </div>
);

interface GameCardProps {
  card: Card;
  view: 'player' | 'opponent' | 'center' | 'deck' | 'discard';
  isFaceUp?: boolean;
  onClick?: () => void;
  className?: string;
  isPlayable?: boolean;
}

export function GameCard({ card, view, isFaceUp = true, onClick, className, isPlayable = false }: GameCardProps) {
  const getVisibleColor = (): Color | null => {
    switch (view) {
      case 'player': return card.frontColor;
      case 'opponent': return card.backColor;
      case 'center': return isFaceUp ? card.frontColor : card.backColor;
      case 'discard': return card.frontColor;
      default: return null;
    }
  };

  const visibleColor = getVisibleColor();
  
  const cardContent = () => {
    if (view === 'deck' || (view === 'center' && isFaceUp === false)) {
      return <CardBack />;
    }
    if (!visibleColor) return <CardBack />;

    const style = COLOR_STYLES[visibleColor];

    return (
      <div className={cn('w-full h-full rounded-lg border-4 flex flex-col items-center justify-center p-2 transition-all', style)}>
        <ColorIcon color={visibleColor} className="w-1/2 h-1/2" />
        <span className="font-bold text-sm uppercase tracking-wider mt-1">{visibleColor}</span>
      </div>
    );
  };

  const cardElement = (
      <div className={cn(
        "aspect-[2.5/3.5] rounded-lg shadow-lg transition-transform duration-300",
        isPlayable && "cursor-pointer hover:scale-105 hover:-translate-y-2 ring-4 ring-accent",
        className
      )}>
        {cardContent()}
      </div>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className="focus:outline-none appearance-none block" disabled={!isPlayable}>
        {cardElement}
      </button>
    );
  }

  return cardElement;
}
