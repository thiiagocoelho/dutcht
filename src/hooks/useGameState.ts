import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Card, GameAction, GameState, createDeck } from '@/types/game';
import { useToast } from './use-toast';
import { Json } from '@/integrations/supabase/types';

interface GameStateData {
  id: string;
  phase: 'memorizing' | 'playing' | 'dutch_round' | 'finished';
  deck: Card[];
  discardPile: Card[];
  playerHands: Record<string, Card[]>;
  revealedCards: Record<string, number[]>;
  lastAction?: GameAction;
}

interface DrawnCard {
  card: Card;
  source: 'deck' | 'discard';
}

export const useGameState = (roomId: string | undefined, players: { id: string }[]) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [gameState, setGameState] = useState<GameStateData | null>(null);
  const [actions, setActions] = useState<GameAction[]>([]);
  const [drawnCard, setDrawnCard] = useState<DrawnCard | null>(null);
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Parse game state from DB
  const parseGameState = useCallback((data: {
    id: string;
    phase: string | null;
    deck: Json | null;
    discard_pile: Json | null;
    player_hands: Json | null;
    revealed_cards: Json | null;
    last_action: Json | null;
  }): GameStateData => {
    return {
      id: data.id,
      phase: (data.phase as GameStateData['phase']) || 'memorizing',
      deck: (data.deck as unknown as Card[]) || [],
      discardPile: (data.discard_pile as unknown as Card[]) || [],
      playerHands: (data.player_hands as unknown as Record<string, Card[]>) || {},
      revealedCards: (data.revealed_cards as Record<string, number[]>) || {},
      lastAction: data.last_action ? (data.last_action as unknown as GameAction) : undefined,
    };
  }, []);

  // Fetch game state
  const fetchGameState = useCallback(async () => {
    if (!roomId) return;

    const { data, error } = await supabase
      .from('game_state')
      .select('*')
      .eq('room_id', roomId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching game state:', error);
      return;
    }

    if (data) {
      setGameState(parseGameState(data));
    }
    setLoading(false);
  }, [roomId, parseGameState]);

  // Fetch actions
  const fetchActions = useCallback(async () => {
    if (!roomId) return;

    const { data, error } = await supabase
      .from('game_actions')
      .select(`
        *,
        profiles:player_id (username)
      `)
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching actions:', error);
      return;
    }

    setActions(data?.map(a => ({
      type: a.action_type as GameAction['type'],
      playerId: a.player_id,
      playerName: (a.profiles as { username: string | null })?.username || 'Jogador',
      data: a.action_data as Record<string, unknown> | undefined,
      timestamp: new Date(a.created_at!),
    })).reverse() || []);
  }, [roomId]);

  // Initialize game state (host only)
  const initializeGame = useCallback(async () => {
    if (!roomId || !user || players.length < 2) return;

    const deck = createDeck();
    const playerHands: Record<string, Card[]> = {};
    const revealedCards: Record<string, number[]> = {};
    
    // Deal 4 cards to each player
    let deckIndex = 0;
    for (const player of players) {
      playerHands[player.id] = deck.slice(deckIndex, deckIndex + 4);
      revealedCards[player.id] = [0, 3]; // Reveal first and last card during memorizing phase
      deckIndex += 4;
    }

    // Remaining deck and first discard
    const remainingDeck = deck.slice(deckIndex + 1);
    const discardPile = [deck[deckIndex]];

    const { error } = await supabase
      .from('game_state')
      .upsert({
        room_id: roomId,
        phase: 'memorizing',
        deck: remainingDeck as unknown as Json,
        discard_pile: discardPile as unknown as Json,
        player_hands: playerHands as unknown as Json,
        revealed_cards: revealedCards as unknown as Json,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error initializing game:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível iniciar o jogo' });
    }
  }, [roomId, user, players, toast]);

  // End memorizing phase
  const endMemorizingPhase = useCallback(async () => {
    if (!roomId || !gameState) return;

    const { error } = await supabase
      .from('game_state')
      .update({
        phase: 'playing',
        revealed_cards: {} as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq('room_id', roomId);

    if (error) {
      console.error('Error ending memorizing phase:', error);
    }
  }, [roomId, gameState]);

  // Draw card from deck or discard
  const drawCard = useCallback(async (source: 'deck' | 'discard') => {
    if (!roomId || !user || !gameState || drawnCard) return;

    const pile = source === 'deck' ? gameState.deck : gameState.discardPile;
    if (pile.length === 0) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Pilha vazia' });
      return;
    }

    const card = pile[pile.length - 1];
    setDrawnCard({ card, source });

    // Log action
    await supabase.from('game_actions').insert({
      room_id: roomId,
      player_id: user.id,
      action_type: 'draw',
      action_data: { source } as unknown as Json,
    });
  }, [roomId, user, gameState, drawnCard, toast]);

  // Swap drawn card with hand card
  const swapWithHand = useCallback(async (handIndex: number) => {
    if (!roomId || !user || !gameState || !drawnCard) return;

    const myHand = gameState.playerHands[user.id] || [];
    const swappedCard = myHand[handIndex];
    const newHand = [...myHand];
    newHand[handIndex] = drawnCard.card;

    const newPlayerHands = {
      ...gameState.playerHands,
      [user.id]: newHand,
    };

    // Update discard pile with swapped card
    let newDeck = gameState.deck;
    let newDiscardPile = gameState.discardPile;

    if (drawnCard.source === 'deck') {
      // Remove card from deck, add swapped to discard
      newDeck = gameState.deck.slice(0, -1);
      newDiscardPile = [...gameState.discardPile, swappedCard];
    } else {
      // Already removed from discard, just add swapped
      newDiscardPile = [...gameState.discardPile.slice(0, -1), swappedCard];
    }

    const { error } = await supabase
      .from('game_state')
      .update({
        deck: newDeck as unknown as Json,
        discard_pile: newDiscardPile as unknown as Json,
        player_hands: newPlayerHands as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq('room_id', roomId);

    if (error) {
      console.error('Error swapping card:', error);
      return;
    }

    // Log action
    await supabase.from('game_actions').insert({
      room_id: roomId,
      player_id: user.id,
      action_type: 'swap',
    });

    setDrawnCard(null);
    setSelectedCardIndex(null);

    // Advance turn
    await advanceTurn();
  }, [roomId, user, gameState, drawnCard]);

  // Discard drawn card
  const discardDrawnCard = useCallback(async () => {
    if (!roomId || !user || !gameState || !drawnCard) return;

    let newDeck = gameState.deck;
    let newDiscardPile = gameState.discardPile;

    if (drawnCard.source === 'deck') {
      newDeck = gameState.deck.slice(0, -1);
      newDiscardPile = [...gameState.discardPile, drawnCard.card];
    }
    // If from discard, it stays there

    const { error } = await supabase
      .from('game_state')
      .update({
        deck: newDeck as unknown as Json,
        discard_pile: newDiscardPile as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq('room_id', roomId);

    if (error) {
      console.error('Error discarding card:', error);
      return;
    }

    // Log action
    await supabase.from('game_actions').insert({
      room_id: roomId,
      player_id: user.id,
      action_type: 'discard',
    });

    setDrawnCard(null);
    
    // Advance turn
    await advanceTurn();
  }, [roomId, user, gameState, drawnCard]);

  // Advance turn
  const advanceTurn = useCallback(async () => {
    if (!roomId || players.length === 0) return;

    // Get current room state
    const { data: roomData } = await supabase
      .from('rooms')
      .select('current_turn, dutch_caller')
      .eq('id', roomId)
      .single();

    if (!roomData) return;

    const currentIndex = players.findIndex(p => p.id === roomData.current_turn);
    const nextIndex = (currentIndex + 1) % players.length;
    const nextPlayer = players[nextIndex];

    // Check if Dutch round is complete
    if (roomData.dutch_caller && nextPlayer.id === roomData.dutch_caller) {
      // End game
      await supabase
        .from('game_state')
        .update({ phase: 'finished', updated_at: new Date().toISOString() })
        .eq('room_id', roomId);

      await supabase
        .from('rooms')
        .update({ status: 'finished' })
        .eq('id', roomId);
      return;
    }

    // Advance to next player
    await supabase
      .from('rooms')
      .update({
        current_turn: nextPlayer.id,
        turn_started_at: new Date().toISOString(),
      })
      .eq('id', roomId);
  }, [roomId, players]);

  // Call Dutch
  const callDutch = useCallback(async () => {
    if (!roomId || !user || !gameState) return;

    const { error } = await supabase
      .from('rooms')
      .update({ dutch_caller: user.id })
      .eq('id', roomId);

    if (error) {
      console.error('Error calling Dutch:', error);
      return;
    }

    await supabase
      .from('game_state')
      .update({ phase: 'dutch_round', updated_at: new Date().toISOString() })
      .eq('room_id', roomId);

    // Log action
    await supabase.from('game_actions').insert({
      room_id: roomId,
      player_id: user.id,
      action_type: 'dutch',
    });

    toast({ title: 'DUTCH! 🎉', description: 'Última rodada começou!' });
    
    // Advance turn
    await advanceTurn();
  }, [roomId, user, gameState, toast, advanceTurn]);

  // Initial fetch
  useEffect(() => {
    fetchGameState();
    fetchActions();
  }, [fetchGameState, fetchActions]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`game-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state', filter: `room_id=eq.${roomId}` }, () => {
        fetchGameState();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_actions', filter: `room_id=eq.${roomId}` }, () => {
        fetchActions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, fetchGameState, fetchActions]);

  const myHand = gameState?.playerHands[user?.id || ''] || [];
  const myRevealedCards = gameState?.revealedCards[user?.id || ''] || [];

  return {
    gameState,
    actions,
    drawnCard,
    selectedCardIndex,
    setSelectedCardIndex,
    myHand,
    myRevealedCards,
    loading,
    initializeGame,
    endMemorizingPhase,
    drawCard,
    swapWithHand,
    discardDrawnCard,
    callDutch,
    refetch: fetchGameState,
  };
};
