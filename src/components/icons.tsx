import type { Color } from '@/lib/types';
import { Flame, Sun, Zap, Leaf, Droplets, Moon, Grape, Star, Skull, type LucideProps } from 'lucide-react';
import type { FC } from 'react';

export const COLOR_ICONS: Record<Color, FC<LucideProps>> = {
  Red: Flame,
  Orange: Sun,
  Yellow: Zap,
  Green: Leaf,
  Blue: Droplets,
  Indigo: Moon,
  Violet: Grape,
  White: Star,
  Black: Skull,
};

export const ColorIcon: FC<{ color: Color; className?: string }> = ({ color, className }) => {
  const Icon = COLOR_ICONS[color];
  if (!Icon) return null;
  return <Icon className={className} aria-label={color} />;
};
