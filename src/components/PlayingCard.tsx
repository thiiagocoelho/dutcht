import { motion } from 'framer-motion';
import { Card, getSuitSymbol, isRedSuit } from '@/types/game';
import { cn } from '@/lib/utils';

interface PlayingCardProps {
  card?: Card;
  faceUp?: boolean;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  animateFlip?: boolean;
  index?: number;
}

export const PlayingCard = ({
  card,
  faceUp = true,
  onClick,
  selected = false,
  disabled = false,
  size = 'md',
  className,
  animateFlip = false,
  index = 0,
}: PlayingCardProps) => {
  const sizeClasses = {
    sm: 'w-12 h-[4.2rem]',
    md: 'w-16 h-[5.6rem]',
    lg: 'w-20 h-[7rem]',
  };

  const fontSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const cardVariants = {
    initial: { 
      rotateY: faceUp ? 180 : 0,
      y: -50,
      opacity: 0,
    },
    animate: { 
      rotateY: faceUp ? 0 : 180,
      y: 0,
      opacity: 1,
      transition: {
        delay: index * 0.1,
        duration: 0.5,
        type: 'spring' as const,
        stiffness: 200,
      },
    },
    hover: disabled ? {} : {
      y: -8,
      scale: 1.05,
      transition: { duration: 0.2 },
    },
    tap: disabled ? {} : {
      scale: 0.95,
    },
  };

  const isRed = card ? isRedSuit(card.suit) : false;
  const suitSymbol = card ? getSuitSymbol(card.suit) : '';

  return (
    <motion.div
      className={cn(
        'relative cursor-pointer perspective-1000',
        sizeClasses[size],
        selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
        disabled && 'cursor-not-allowed opacity-60',
        className
      )}
      variants={animateFlip ? cardVariants : undefined}
      initial={animateFlip ? 'initial' : undefined}
      animate={animateFlip ? 'animate' : undefined}
      whileHover="hover"
      whileTap="tap"
      onClick={disabled ? undefined : onClick}
      style={{ transformStyle: 'preserve-3d' }}
    >
      {/* Card Container */}
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: faceUp ? 0 : 180 }}
        transition={{ duration: 0.4, type: 'spring', stiffness: 300 }}
      >
        {/* Front Face */}
        <div
          className={cn(
            'absolute inset-0 rounded-lg shadow-lg flex flex-col items-center justify-center backface-hidden',
            'bg-gradient-to-br from-white to-gray-100 border border-gray-200'
          )}
          style={{ backfaceVisibility: 'hidden' }}
        >
          {card && (
            <>
              <span className={cn(
                fontSizes[size],
                'font-bold',
                isRed ? 'text-card-red' : 'text-gray-800'
              )}>
                {card.rank}
              </span>
              <span className={cn(
                size === 'sm' ? 'text-lg' : size === 'md' ? 'text-xl' : 'text-2xl',
                isRed ? 'text-card-red' : 'text-gray-800'
              )}>
                {suitSymbol}
              </span>
            </>
          )}
        </div>

        {/* Back Face */}
        <div
          className={cn(
            'absolute inset-0 rounded-lg shadow-lg backface-hidden',
            'bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900',
            'border-2 border-blue-700'
          )}
          style={{ 
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <div className="absolute inset-1 rounded border border-blue-600/30 flex items-center justify-center">
            <div className="w-3/4 h-3/4 rounded bg-gradient-to-br from-blue-700/50 to-indigo-800/50 border border-blue-500/20 flex items-center justify-center">
              <span className="text-blue-300/50 text-lg font-serif">♠</span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
