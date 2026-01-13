import { motion } from 'framer-motion';
import { PlayingCard } from './PlayingCard';
import { Card } from '@/types/game';
import { cn } from '@/lib/utils';

interface PlayerHandProps {
  cards: Card[];
  revealedIndices?: number[];
  isCurrentPlayer?: boolean;
  onCardClick?: (index: number) => void;
  selectedCardIndex?: number | null;
  disabled?: boolean;
  className?: string;
}

export const PlayerHand = ({
  cards,
  revealedIndices = [],
  isCurrentPlayer = false,
  onCardClick,
  selectedCardIndex,
  disabled = false,
  className,
}: PlayerHandProps) => {
  const cardCount = cards.length;
  const fanAngle = Math.min(8, 40 / cardCount); // Angle between cards
  const startAngle = -((cardCount - 1) * fanAngle) / 2;

  return (
    <motion.div
      className={cn(
        'relative flex items-end justify-center',
        isCurrentPlayer ? 'h-32' : 'h-24',
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {cards.map((card, index) => {
        const angle = startAngle + index * fanAngle;
        const isRevealed = revealedIndices.includes(index);
        const isSelected = selectedCardIndex === index;

        return (
          <motion.div
            key={card.id}
            className="absolute"
            style={{
              transformOrigin: 'bottom center',
            }}
            initial={{ 
              rotate: 0, 
              x: 0,
              y: 50,
              opacity: 0,
            }}
            animate={{ 
              rotate: angle,
              x: index * (isCurrentPlayer ? 30 : 20) - (cardCount - 1) * (isCurrentPlayer ? 15 : 10),
              y: isSelected ? -20 : 0,
              opacity: 1,
            }}
            transition={{
              delay: index * 0.05,
              type: 'spring',
              stiffness: 200,
              damping: 20,
            }}
          >
            <PlayingCard
              card={card}
              faceUp={isCurrentPlayer || isRevealed}
              size={isCurrentPlayer ? 'lg' : 'md'}
              onClick={() => onCardClick?.(index)}
              selected={isSelected}
              disabled={disabled}
              index={index}
            />
          </motion.div>
        );
      })}
    </motion.div>
  );
};
