import { motion } from 'framer-motion';
import { PlayingCard } from './PlayingCard';
import { Card } from '@/types/game';
import { cn } from '@/lib/utils';

interface CardPileProps {
  cards: Card[];
  type: 'deck' | 'discard';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export const CardPile = ({
  cards,
  type,
  onClick,
  disabled = false,
  className,
}: CardPileProps) => {
  const topCard = cards[cards.length - 1];
  const cardCount = cards.length;

  return (
    <motion.div
      className={cn(
        'relative cursor-pointer',
        disabled && 'cursor-not-allowed opacity-60',
        className
      )}
      whileHover={disabled ? {} : { scale: 1.05 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      onClick={disabled ? undefined : onClick}
    >
      {/* Stacked cards effect */}
      {cardCount > 1 && (
        <>
          <div className="absolute top-0 left-0 w-16 h-[5.6rem] rounded-lg bg-gradient-to-br from-blue-900 to-indigo-900 shadow-lg transform translate-x-1 translate-y-1" />
          {cardCount > 5 && (
            <div className="absolute top-0 left-0 w-16 h-[5.6rem] rounded-lg bg-gradient-to-br from-blue-800 to-indigo-800 shadow-lg transform translate-x-0.5 translate-y-0.5" />
          )}
        </>
      )}

      {/* Top card or empty pile */}
      {cardCount > 0 ? (
        <PlayingCard
          card={topCard}
          faceUp={type === 'discard'}
          size="md"
          disabled={disabled}
        />
      ) : (
        <div className="w-16 h-[5.6rem] rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center bg-white/5">
          <span className="text-white/30 text-xs">Vazio</span>
        </div>
      )}

      {/* Card count badge */}
      {type === 'deck' && cardCount > 0 && (
        <motion.div
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-lg"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500 }}
        >
          {cardCount}
        </motion.div>
      )}

      {/* Label */}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground whitespace-nowrap">
        {type === 'deck' ? 'Comprar' : 'Descarte'}
      </div>
    </motion.div>
  );
};
