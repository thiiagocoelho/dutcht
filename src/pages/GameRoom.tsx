import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Crown, Play, Check, Loader2, Hand } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useGameRoom } from '@/hooks/useGameRoom';
import { useGameState } from '@/hooks/useGameState';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { PlayerHand } from '@/components/PlayerHand';
import { CardPile } from '@/components/CardPile';
import { PlayingCard } from '@/components/PlayingCard';
import { GameTimer } from '@/components/GameTimer';
import { ActionLog } from '@/components/ActionLog';
import { GameChat } from '@/components/GameChat';
import { calculateScore } from '@/types/game';
import { cn } from '@/lib/utils';

const MEMORIZE_TIME = 10; // seconds
const TURN_TIME = 30; // seconds

const GameRoom = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [memorizingCountdown, setMemorizingCountdown] = useState<number | null>(null);

  const {
    room,
    players,
    chatMessages,
    loading: roomLoading,
    error,
    isHost,
    isMyTurn,
    sendChatMessage,
    toggleReady,
    leaveRoom,
    startGame,
  } = useGameRoom(roomId);

  const {
    gameState,
    actions,
    drawnCard,
    selectedCardIndex,
    setSelectedCardIndex,
    myHand,
    myRevealedCards,
    loading: gameLoading,
    initializeGame,
    endMemorizingPhase,
    drawCard,
    swapWithHand,
    discardDrawnCard,
    callDutch,
  } = useGameState(roomId, players);

  // Handle game start
  useEffect(() => {
    if (room?.status === 'playing' && !gameState && isHost) {
      initializeGame();
    }
  }, [room?.status, gameState, isHost, initializeGame]);

  // Handle memorizing phase countdown
  useEffect(() => {
    if (gameState?.phase === 'memorizing') {
      setMemorizingCountdown(MEMORIZE_TIME);
      const interval = setInterval(() => {
        setMemorizingCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            if (isHost) {
              endMemorizingPhase();
            }
            return null;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [gameState?.phase, isHost, endMemorizingPhase]);

  const handleLeave = async () => {
    await leaveRoom();
    navigate('/lobby');
  };

  const handleCardClick = (index: number) => {
    if (!isMyTurn || gameState?.phase !== 'playing') return;
    
    if (drawnCard) {
      // If we have a drawn card, swap it
      swapWithHand(index);
    } else {
      // Select/deselect card
      setSelectedCardIndex(selectedCardIndex === index ? null : index);
    }
  };

  const handleDeckClick = () => {
    if (!isMyTurn || gameState?.phase !== 'playing' || drawnCard) return;
    drawCard('deck');
  };

  const handleDiscardClick = () => {
    if (!isMyTurn || gameState?.phase !== 'playing') return;
    
    if (drawnCard) {
      // Discard the drawn card
      discardDrawnCard();
    } else {
      // Draw from discard
      drawCard('discard');
    }
  };

  const handleDutchCall = () => {
    if (!isMyTurn || gameState?.phase !== 'playing' || drawnCard) return;
    callDutch();
  };

  if (!user) {
    navigate('/');
    return null;
  }

  if (roomLoading || gameLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-destructive">{error || 'Sala não encontrada'}</p>
        <Button onClick={() => navigate('/lobby')}>Voltar ao Lobby</Button>
      </div>
    );
  }

  const currentPlayer = players.find(p => p.id === room.currentTurn);
  const otherPlayers = players.filter(p => p.id !== user.id);

  // Position players around the table
  const getPlayerPosition = (index: number, total: number): 'top' | 'left' | 'right' => {
    if (total === 1) return 'top';
    if (total === 2) return index === 0 ? 'left' : 'right';
    if (index === 0) return 'top';
    if (index < total / 2) return 'left';
    return 'right';
  };

  return (
    <div className="min-h-screen p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-game-table opacity-40" />
      
      <div className="relative z-10 max-w-6xl mx-auto h-[calc(100vh-2rem)] flex flex-col">
        {/* Header */}
        <motion.div
          className="flex items-center justify-between mb-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleLeave}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">{room.name}</h1>
              <p className="text-xs text-muted-foreground">Código: {room.code}</p>
            </div>
          </div>

          {room.status === 'playing' && (
            <div className="flex items-center gap-4">
              {gameState?.phase === 'memorizing' && memorizingCountdown !== null && (
                <motion.div 
                  className="px-4 py-2 rounded-full bg-accent/20 text-accent font-bold"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                >
                  Memorize suas cartas! {memorizingCountdown}s
                </motion.div>
              )}
              {gameState?.phase === 'dutch_round' && (
                <motion.div 
                  className="px-4 py-2 rounded-full bg-accent text-accent-foreground font-bold"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                >
                  🎉 DUTCH! Última Rodada
                </motion.div>
              )}
              {isMyTurn && gameState?.phase === 'playing' && (
                <GameTimer
                  duration={TURN_TIME}
                  isActive={isMyTurn}
                  onTimeout={() => {
                    // Auto-pass turn on timeout
                    if (drawnCard) {
                      discardDrawnCard();
                    }
                  }}
                />
              )}
            </div>
          )}
        </motion.div>

        {/* Waiting Room */}
        {room.status === 'waiting' && (
          <motion.div
            className="flex-1 flex flex-col items-center justify-center gap-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="glass-card rounded-2xl p-8 max-w-md w-full">
              <h2 className="text-2xl font-bold text-center mb-6">Sala de Espera</h2>
              
              <div className="space-y-3 mb-6">
                {players.map(player => (
                  <div
                    key={player.id}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-xl',
                      player.id === user.id ? 'bg-primary/20' : 'bg-muted/30'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {player.id === room.hostId && (
                        <Crown className="w-4 h-4 text-accent" />
                      )}
                      <span className="font-medium">{player.username}</span>
                    </div>
                    {player.isReady ? (
                      <span className="text-primary flex items-center gap-1">
                        <Check className="w-4 h-4" /> Pronto
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Aguardando...</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                {isHost ? (
                  <Button
                    className="flex-1"
                    onClick={startGame}
                    disabled={players.length < 2}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Iniciar Jogo
                  </Button>
                ) : (
                  <Button
                    className="flex-1"
                    variant={players.find(p => p.id === user.id)?.isReady ? 'secondary' : 'default'}
                    onClick={toggleReady}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    {players.find(p => p.id === user.id)?.isReady ? 'Cancelar' : 'Estou Pronto'}
                  </Button>
                )}
              </div>

              <p className="text-center text-sm text-muted-foreground mt-4">
                {players.length}/{room.maxPlayers} jogadores
              </p>
            </div>
          </motion.div>
        )}

        {/* Game Board */}
        {room.status === 'playing' && gameState && (
          <div className="flex-1 grid grid-cols-12 gap-4">
            {/* Left sidebar - Other players & Chat */}
            <div className="col-span-3 flex flex-col gap-4">
              <div className="space-y-3">
                {otherPlayers.map((player, index) => {
                  const playerCardCount = gameState.playerCardCounts[player.id] || 0;
                  return (
                    <motion.div
                      key={player.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <PlayerAvatar
                        username={player.username}
                        avatarUrl={player.avatarUrl}
                        isActive={room.currentTurn === player.id}
                        position={getPlayerPosition(index, otherPlayers.length)}
                        cardCount={playerCardCount}
                        score={gameState.phase === 'finished' ? undefined : undefined}
                      />
                    </motion.div>
                  );
                })}
              </div>
              
              <GameChat
                messages={chatMessages}
                onSendMessage={sendChatMessage}
                currentUserId={user.id}
                className="flex-1"
              />
            </div>

            {/* Center - Game Table */}
            <div className="col-span-6 flex flex-col items-center justify-between py-4">
              {/* Current turn indicator */}
              {currentPlayer && (
                <motion.div
                  className={cn(
                    'px-4 py-2 rounded-full text-sm font-medium',
                    isMyTurn ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  )}
                  animate={isMyTurn ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ duration: 0.5, repeat: Infinity }}
                >
                  {isMyTurn ? 'Sua vez!' : `Vez de ${currentPlayer.username}`}
                </motion.div>
              )}

              {/* Card piles */}
              <div className="flex items-center gap-12">
                <CardPile
                  cardCount={gameState.deckCount}
                  type="deck"
                  onClick={handleDeckClick}
                  disabled={!isMyTurn || gameState.phase !== 'playing' || !!drawnCard}
                />
                
                {/* Drawn card display */}
                <AnimatePresence>
                  {drawnCard && (
                    <motion.div
                      className="flex flex-col items-center gap-2"
                      initial={{ scale: 0, y: -50 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0, y: 50 }}
                    >
                      <PlayingCard
                        card={drawnCard.card}
                        faceUp={true}
                        size="lg"
                        className="ring-2 ring-primary"
                      />
                      <p className="text-xs text-muted-foreground">
                        Clique em uma carta para trocar
                      </p>
                      <Button size="sm" variant="outline" onClick={discardDrawnCard}>
                        Descartar
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <CardPile
                  cards={gameState.discardPile}
                  type="discard"
                  onClick={handleDiscardClick}
                  disabled={!isMyTurn || gameState.phase !== 'playing'}
                />
              </div>

              {/* My hand */}
              <div className="w-full">
                <div className="flex items-center justify-center gap-4 mb-2">
                  <Hand className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Suas cartas</span>
                  {gameState.phase === 'finished' && (
                    <span className="text-accent font-bold">
                      {calculateScore(myHand)} pontos
                    </span>
                  )}
                </div>
                <PlayerHand
                  cards={myHand}
                  revealedIndices={gameState.phase === 'memorizing' ? myRevealedCards : (gameState.phase === 'finished' ? [0, 1, 2, 3] : [])}
                  isCurrentPlayer={true}
                  onCardClick={handleCardClick}
                  selectedCardIndex={selectedCardIndex}
                  disabled={!isMyTurn || gameState.phase !== 'playing'}
                />
              </div>

              {/* Dutch button */}
              {isMyTurn && gameState.phase === 'playing' && !drawnCard && !room.dutchCaller && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <Button
                    variant="outline"
                    className="border-accent text-accent hover:bg-accent hover:text-accent-foreground"
                    onClick={handleDutchCall}
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    Chamar DUTCH!
                  </Button>
                </motion.div>
              )}
            </div>

            {/* Right sidebar - Action Log */}
            <div className="col-span-3">
              <ActionLog actions={actions} className="h-full" />
            </div>
          </div>
        )}

        {/* Game Finished */}
        {room.status === 'finished' && gameState?.phase === 'finished' && (
          <motion.div
            className="flex-1 flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="glass-card rounded-2xl p-8 max-w-lg w-full text-center">
              <h2 className="text-3xl font-bold mb-6">Fim de Jogo! 🎉</h2>
              
              <div className="space-y-3 mb-6">
                {players
                  .map(player => ({
                    ...player,
                    score: gameState.playerScores?.[player.id] ?? 0,
                  }))
                  .sort((a, b) => a.score - b.score)
                  .map((player, index) => (
                    <div
                      key={player.id}
                      className={cn(
                        'flex items-center justify-between p-4 rounded-xl',
                        index === 0 && 'bg-accent/30 ring-2 ring-accent',
                        index > 0 && 'bg-muted/30'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {index === 0 && <Crown className="w-5 h-5 text-accent" />}
                        <span className="font-medium">{player.username}</span>
                        {player.id === room.dutchCaller && (
                          <span className="text-xs bg-primary/20 px-2 py-0.5 rounded-full">
                            Dutch
                          </span>
                        )}
                      </div>
                      <span className="text-2xl font-bold">{player.score}</span>
                    </div>
                  ))}
              </div>

              <Button onClick={() => navigate('/lobby')} className="w-full">
                Voltar ao Lobby
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default GameRoom;
