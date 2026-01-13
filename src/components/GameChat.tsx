import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MessageCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from '@/types/game';
import { cn } from '@/lib/utils';

interface GameChatProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  currentUserId: string;
  className?: string;
}

export const GameChat = ({
  messages,
  onSendMessage,
  currentUserId,
  className,
}: GameChatProps) => {
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  return (
    <div className={cn('glass-card rounded-xl p-4 flex flex-col', className)}>
      <h3 className="text-sm font-semibold mb-3 text-muted-foreground flex items-center gap-2">
        <MessageCircle className="w-4 h-4" />
        Chat
      </h3>
      
      <ScrollArea className="flex-1 h-32 pr-4 custom-scrollbar" ref={scrollRef}>
        <AnimatePresence>
          {messages.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Nenhuma mensagem...
            </p>
          ) : (
            <div className="space-y-2">
              {messages.map((msg) => {
                const isOwn = msg.playerId === currentUserId;
                
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={cn(
                      'flex flex-col p-2 rounded-lg text-xs max-w-[85%]',
                      isOwn ? 'bg-primary/20 ml-auto' : 'bg-muted/30'
                    )}
                  >
                    {!isOwn && (
                      <span className="text-primary font-medium text-[10px]">
                        {msg.playerName}
                      </span>
                    )}
                    <span className="break-words">{msg.message}</span>
                  </motion.div>
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </ScrollArea>

      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Mensagem..."
          className="text-xs h-8 glass-input"
          maxLength={100}
        />
        <Button type="submit" size="sm" className="h-8 w-8 p-0">
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
};
