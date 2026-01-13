import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GameAction } from '@/types/game';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ArrowRight, Eye, Shuffle, Swords, Crown, AlertCircle } from 'lucide-react';

interface ActionLogProps {
  actions: GameAction[];
  className?: string;
}

const actionIcons: Record<string, React.ReactNode> = {
  draw: <ArrowRight className="w-4 h-4 text-primary" />,
  discard: <ArrowRight className="w-4 h-4 text-muted-foreground rotate-90" />,
  swap: <Shuffle className="w-4 h-4 text-accent" />,
  cut: <Swords className="w-4 h-4 text-destructive" />,
  peek: <Eye className="w-4 h-4 text-blue-400" />,
  blind_swap: <Shuffle className="w-4 h-4 text-purple-400" />,
  dutch: <Crown className="w-4 h-4 text-accent" />,
  penalty: <AlertCircle className="w-4 h-4 text-destructive" />,
};

const actionMessages: Record<string, (playerName: string, data?: Record<string, unknown>) => string> = {
  draw: (name) => `${name} comprou uma carta`,
  discard: (name) => `${name} descartou uma carta`,
  swap: (name) => `${name} trocou uma carta`,
  cut: (name) => `${name} cortou o descarte!`,
  peek: (name) => `${name} espiou uma carta`,
  blind_swap: (name, data) => `${name} trocou carta com ${data?.targetName || 'outro jogador'}`,
  dutch: (name) => `${name} chamou DUTCH! 🎉`,
  penalty: (name) => `${name} recebeu penalidade`,
};

export const ActionLog = ({ actions, className }: ActionLogProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [actions]);

  return (
    <div className={cn('glass-card rounded-xl p-4', className)}>
      <h3 className="text-sm font-semibold mb-3 text-muted-foreground flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        Histórico de Ações
      </h3>
      
      <ScrollArea className="h-48 pr-4 custom-scrollbar" ref={scrollRef}>
        <AnimatePresence>
          {actions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Nenhuma ação ainda...
            </p>
          ) : (
            <div className="space-y-2">
              {actions.map((action, index) => (
                <motion.div
                  key={action.timestamp.toString() + index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 text-xs"
                >
                  {actionIcons[action.type] || <ArrowRight className="w-4 h-4" />}
                  <span className="flex-1">
                    {actionMessages[action.type]?.(action.playerName || 'Jogador', action.data) || 
                     `${action.playerName} fez uma ação`}
                  </span>
                  <span className="text-muted-foreground text-[10px]">
                    {new Date(action.timestamp).toLocaleTimeString('pt-BR', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </ScrollArea>
    </div>
  );
};
