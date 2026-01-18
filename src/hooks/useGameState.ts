import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Card, GameAction, GameState, createDeck } from '@/types/game';
import { useToast } from './use-toast';
import { Json } from '@/integrations/supabase/types';

interface GameStateData {
  id: string;
  phase: 'memorizing' | 'playing' | 'dutch_round' | 'finished';
  deckCount: number;  // Only deck count, not the actual cards
  discardPile: Card[];
  myHand: Card[];  // Only the current player's cards
  myRevealedCards: number[];  // Only the current player's revealed cards
  playerCardCounts: Record<string, number>;  // Other players' card counts only
  playerScores?: Record<string, number>;  // Scores when game is finished
  lastAction?: GameAction;
}

interface DrawnCard {
  card: Card;
  source: 'deck' | 'discard';
}

interface SecureGameStateResponse {
  id: string;
  room_id: string;
  phase: string;
  deck_count: number;
  discard_pile: Card[];
  player_hands: Record<string, { cards: Card[] | null; cardCount: number }>;
  revealed_cards: Record<string, number[]>;
  player_scores?: Record<string, number>;
  last_action: unknown | null;
  updated_at: string | null;
}

export const useGameState = (roomId: string | undefined, players: { id: string }[]) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [gameState, setGameState] = useState<GameStateData | null>(null);
  const [actions, setActions] = useState<GameAction[]>([]);
  const [drawnCard, setDrawnCard] = useState<DrawnCard | null>(null);
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch game state securely via edge function
  const fetchGameState = useCallback(async () => {
    if (!roomId || !user) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) {
        console.error('No access token available');
        setLoading(false);
        return;
      }

      const response = await supabase.functions.invoke('get-game-state', {
        body: { room_id: roomId },
      });

      if (response.error) {
        console.error('Error fetching game state:', response.error);
        setLoading(false);
        return;
      }

      const result = response.data;
      
      if (!result?.data) {
        setGameState(null);
        setLoading(false);
        return;
      }

      const secureState = result.data as SecureGameStateResponse;
      
      // Build card counts for all players
      const playerCardCounts: Record<string, number> = {};
      for (const [playerId, handInfo] of Object.entries(secureState.player_hands)) {
        playerCardCounts[playerId] = handInfo.cardCount;
      }

      // Extract current player's hand
      const myHandInfo = secureState.player_hands[user.id];
      const myHand = myHandInfo?.cards || [];
      const myRevealedCards = secureState.revealed_cards[user.id] || [];

      setGameState({
        id: secureState.id,
        phase: secureState.phase as GameStateData['phase'],
        deckCount: secureState.deck_count,
        discardPile: secureState.discard_pile || [],
        myHand,
        myRevealedCards,
        playerCardCounts,
        playerScores: secureState.player_scores,
        lastAction: secureState.last_action as GameAction | undefined,
      });
      setLoading(false);
    } catch (error) {
      console.error('Error fetching game state:', error);
      setLoading(false);
    }
  }, [roomId, user]);

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

  // Draw card from deck or discard via edge function
  const drawCard = useCallback(async (source: 'deck' | 'discard') => {
    if (!roomId || !user || !gameState || drawnCard) return;

    // For discard, we can see the top card; for deck, we need to fetch it
    if (source === 'discard') {
      if (gameState.discardPile.length === 0) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Pilha vazia' });
        return;
      }
      const card = gameState.discardPile[gameState.discardPile.length - 1];
      setDrawnCard({ card, source });
      
      // Log action
      await supabase.from('game_actions').insert({
        room_id: roomId,
        player_id: user.id,
        action_type: 'draw',
        action_data: { source } as unknown as Json,
      });
      return;
    }

    // For deck, use edge function to get the card securely
    if (gameState.deckCount === 0) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Deck vazio' });
      return;
    }

    try {
      const response = await supabase.functions.invoke('game-action', {
        body: { room_id: roomId, action: 'draw', source },
      });

      if (response.error) {
        console.error('Error drawing card:', response.error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível comprar carta' });
        return;
      }

      const result = response.data;
      if (result.success && result.drawnCard) {
        setDrawnCard({ card: result.drawnCard, source });
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.error || 'Não foi possível comprar carta' });
      }
    } catch (error) {
      console.error('Error drawing card:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao comprar carta' });
    }
  }, [roomId, user, gameState, drawnCard, toast]);

  // Swap drawn card with hand card via edge function
  const swapWithHand = useCallback(async (handIndex: number) => {
    if (!roomId || !user || !gameState || !drawnCard) return;

    try {
      const response = await supabase.functions.invoke('game-action', {
        body: { 
          room_id: roomId, 
          action: 'swap', 
          hand_index: handIndex,
          drawn_card: drawnCard.card,
          drawn_source: drawnCard.source,
        },
      });

      if (response.error) {
        console.error('Error swapping card:', response.error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível trocar carta' });
        return;
      }

      const result = response.data;
      if (!result.success) {
        toast({ variant: 'destructive', title: 'Erro', description: result.error || 'Não foi possível trocar carta' });
        return;
      }

      setDrawnCard(null);
      setSelectedCardIndex(null);
      // Game state will update via realtime subscription
    } catch (error) {
      console.error('Error swapping card:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao trocar carta' });
    }
  }, [roomId, user, gameState, drawnCard, toast]);

  // Discard drawn card via edge function
  const discardDrawnCard = useCallback(async () => {
    if (!roomId || !user || !gameState || !drawnCard) return;

    try {
      const response = await supabase.functions.invoke('game-action', {
        body: { 
          room_id: roomId, 
          action: 'discard',
          drawn_card: drawnCard.card,
          drawn_source: drawnCard.source,
        },
      });

      if (response.error) {
        console.error('Error discarding card:', response.error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível descartar carta' });
        return;
      }

      const result = response.data;
      if (!result.success) {
        toast({ variant: 'destructive', title: 'Erro', description: result.error || 'Não foi possível descartar carta' });
        return;
      }

      setDrawnCard(null);
      // Game state will update via realtime subscription
    } catch (error) {
      console.error('Error discarding card:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao descartar carta' });
    }
  }, [roomId, user, gameState, drawnCard, toast]);

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
  }, [roomId, user, gameState, toast]);

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

  return {
    gameState,
    actions,
    drawnCard,
    selectedCardIndex,
    setSelectedCardIndex,
    myHand: gameState?.myHand || [],
    myRevealedCards: gameState?.myRevealedCards || [],
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
