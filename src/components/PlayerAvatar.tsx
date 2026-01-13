import { motion } from 'framer-motion';
import { User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface PlayerAvatarProps {
  username: string;
  avatarUrl?: string;
  isActive?: boolean;
  isCurrentUser?: boolean;
  position: 'top' | 'left' | 'right' | 'bottom';
  cardCount?: number;
  score?: number;
  className?: string;
}

export const PlayerAvatar = ({
  username,
  avatarUrl,
  isActive = false,
  isCurrentUser = false,
  position,
  cardCount = 5,
  score,
  className,
}: PlayerAvatarProps) => {
  const positionStyles = {
    top: 'flex-col',
    bottom: 'flex-col-reverse',
    left: 'flex-row',
    right: 'flex-row-reverse',
  };

  return (
    <motion.div
      className={cn(
        'flex items-center gap-2 p-2 rounded-xl',
        positionStyles[position],
        isActive && 'glass glow-primary',
        !isActive && 'glass-card',
        isCurrentUser && 'ring-2 ring-accent/50',
        className
      )}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200 }}
    >
      <motion.div
        className="relative"
        animate={isActive ? {
          boxShadow: [
            '0 0 10px hsl(var(--primary) / 0.5)',
            '0 0 20px hsl(var(--primary) / 0.7)',
            '0 0 10px hsl(var(--primary) / 0.5)',
          ],
        } : {}}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <Avatar className={cn(
          'border-2',
          isActive ? 'border-primary' : 'border-border',
          isCurrentUser && 'border-accent'
        )}>
          <AvatarImage src={avatarUrl} alt={username} />
          <AvatarFallback className="bg-secondary text-secondary-foreground">
            <User className="w-4 h-4" />
          </AvatarFallback>
        </Avatar>
        
        {/* Active indicator */}
        {isActive && (
          <motion.div
            className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </motion.div>

      <div className={cn(
        'flex flex-col',
        position === 'left' || position === 'right' ? 'text-left' : 'text-center'
      )}>
        <span className={cn(
          'text-sm font-medium truncate max-w-20',
          isCurrentUser && 'text-accent'
        )}>
          {username}
        </span>
        
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{cardCount} cartas</span>
          {score !== undefined && (
            <span className="text-accent font-bold">{score} pts</span>
          )}
        </div>
      </div>
    </motion.div>
  );
};
