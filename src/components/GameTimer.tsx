import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GameTimerProps {
  duration: number; // in seconds
  onTimeout?: () => void;
  isActive?: boolean;
  className?: string;
}

export const GameTimer = ({
  duration,
  onTimeout,
  isActive = true,
  className,
}: GameTimerProps) => {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    setTimeLeft(duration);
  }, [duration]);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onTimeout?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, onTimeout]);

  const percentage = (timeLeft / duration) * 100;
  const isCritical = timeLeft <= 10;

  return (
    <motion.div
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-full glass-card',
        isCritical && 'glow-danger',
        className
      )}
      animate={isCritical ? {
        scale: [1, 1.05, 1],
      } : {}}
      transition={{ duration: 0.5, repeat: isCritical ? Infinity : 0 }}
    >
      <Clock className={cn(
        'w-5 h-5',
        isCritical ? 'text-destructive' : 'text-muted-foreground'
      )} />
      
      <div className="relative w-20 h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={cn(
            'absolute left-0 top-0 h-full rounded-full',
            isCritical ? 'bg-destructive' : 'bg-primary'
          )}
          initial={{ width: '100%' }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      
      <span className={cn(
        'text-sm font-bold min-w-8 text-center',
        isCritical && 'timer-critical'
      )}>
        {timeLeft}s
      </span>
    </motion.div>
  );
};
