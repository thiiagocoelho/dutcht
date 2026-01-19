import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Player, ChatMessage } from '@/types/game';
import { useToast } from './use-toast';

interface RoomData {
  id: string;
  code: string;
  name: string;
  hostId: string;
  maxPlayers: number;
  status: 'waiting' | 'playing' | 'finished';
  currentTurn: string | null;
  turnStartedAt: Date | null;
  dutchCaller: string | null;
}

// Type for the rooms_public view (excludes password)
interface RoomPublicRow {
  id: string;
  code: string;
  name: string;
  host_id: string;
  is_private: boolean | null;
  max_players: number | null;
  status: string | null;
  created_at: string | null;
  current_turn: string | null;
  turn_started_at: string | null;
  dutch_caller: string | null;
}

export const useGameRoom = (roomId: string | undefined) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [room, setRoom] = useState<RoomData | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch room data - use rooms_public view to avoid exposing passwords
  const fetchRoom = useCallback(async () => {
    if (!roomId) return;

    const { data, error } = await supabase
      .from('rooms_public' as any)
      .select('*')
      .eq('id', roomId)
      .single();

    if (error) {
      setError('Sala não encontrada');
      return;
    }

    const roomData = data as unknown as RoomPublicRow;
    setRoom({
      id: roomData.id,
      code: roomData.code,
      name: roomData.name,
      hostId: roomData.host_id,
      maxPlayers: roomData.max_players ?? 4,
      status: roomData.status as RoomData['status'],
      currentTurn: roomData.current_turn,
      turnStartedAt: roomData.turn_started_at ? new Date(roomData.turn_started_at) : null,
      dutchCaller: roomData.dutch_caller,
    });
  }, [roomId]);

  // Fetch players with profiles
  const fetchPlayers = useCallback(async () => {
    if (!roomId) return;

    const { data, error } = await supabase
      .from('room_players')
      .select(`
        *,
        profiles:player_id (username, avatar_url)
      `)
      .eq('room_id', roomId)
      .order('position', { ascending: true });

    if (error) {
      console.error('Error fetching players:', error);
      return;
    }

    setPlayers(data?.map(p => ({
      id: p.player_id,
      username: (p.profiles as { username: string | null })?.username || 'Jogador',
      avatarUrl: (p.profiles as { avatar_url: string | null })?.avatar_url || undefined,
      position: p.position,
      isReady: p.is_ready ?? false,
    })) || []);
  }, [roomId]);

  // Fetch chat messages
  const fetchChatMessages = useCallback(async () => {
    if (!roomId) return;

    const { data, error } = await supabase
      .from('chat_messages')
      .select(`
        *,
        profiles:player_id (username)
      `)
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      console.error('Error fetching chat messages:', error);
      return;
    }

    setChatMessages(data?.map(m => ({
      id: m.id,
      roomId: m.room_id,
      playerId: m.player_id,
      playerName: (m.profiles as { username: string | null })?.username || 'Jogador',
      message: m.message,
      createdAt: new Date(m.created_at!),
    })) || []);
  }, [roomId]);

  // Send chat message
  const sendChatMessage = useCallback(async (message: string) => {
    if (!roomId || !user) return;

    const { error } = await supabase
      .from('chat_messages')
      .insert({
        room_id: roomId,
        player_id: user.id,
        message,
      });

    if (error) {
      console.error('Error sending message:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível enviar a mensagem' });
    }
  }, [roomId, user, toast]);

  // Toggle ready status
  const toggleReady = useCallback(async () => {
    if (!roomId || !user) return;

    const currentPlayer = players.find(p => p.id === user.id);
    if (!currentPlayer) return;

    const { error } = await supabase
      .from('room_players')
      .update({ is_ready: !currentPlayer.isReady })
      .eq('room_id', roomId)
      .eq('player_id', user.id);

    if (error) {
      console.error('Error toggling ready:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível atualizar status' });
    }
  }, [roomId, user, players, toast]);

  // Leave room
  const leaveRoom = useCallback(async () => {
    if (!roomId || !user) return;

    const { error } = await supabase
      .from('room_players')
      .delete()
      .eq('room_id', roomId)
      .eq('player_id', user.id);

    if (error) {
      console.error('Error leaving room:', error);
    }
  }, [roomId, user]);

  // Start game (host only)
  const startGame = useCallback(async () => {
    if (!roomId || !user || room?.hostId !== user.id) return;

    const allReady = players.every(p => p.isReady || p.id === room.hostId);
    if (!allReady) {
      toast({ variant: 'destructive', title: 'Aguarde', description: 'Todos os jogadores precisam estar prontos' });
      return;
    }

    if (players.length < 2) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Mínimo de 2 jogadores para iniciar' });
      return;
    }

    // Update room status to playing
    const { error } = await supabase
      .from('rooms')
      .update({ 
        status: 'playing',
        current_turn: players[0].id,
        turn_started_at: new Date().toISOString(),
      })
      .eq('id', roomId);

    if (error) {
      console.error('Error starting game:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível iniciar o jogo' });
    }
  }, [roomId, user, room, players, toast]);

  // Initial fetch
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchRoom(), fetchPlayers(), fetchChatMessages()]);
      setLoading(false);
    };
    init();
  }, [fetchRoom, fetchPlayers, fetchChatMessages]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`room-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, () => {
        fetchRoom();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` }, () => {
        fetchPlayers();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` }, (payload) => {
        // Add new message to state (fetch to get profile data)
        fetchChatMessages();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, fetchRoom, fetchPlayers, fetchChatMessages]);

  const isHost = user?.id === room?.hostId;
  const currentPlayer = players.find(p => p.id === user?.id);
  const isMyTurn = room?.currentTurn === user?.id;

  return {
    room,
    players,
    chatMessages,
    loading,
    error,
    isHost,
    currentPlayer,
    isMyTurn,
    sendChatMessage,
    toggleReady,
    leaveRoom,
    startGame,
    refetch: () => Promise.all([fetchRoom(), fetchPlayers()]),
  };
};
