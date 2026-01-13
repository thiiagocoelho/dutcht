import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Lock, Unlock, LogOut, RefreshCw, Key, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Room } from '@/types/game';

const Lobby = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  
  // Create room form
  const [roomName, setRoomName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('4');

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    fetchRooms();
    
    // Subscribe to room changes
    const channel = supabase
      .channel('rooms-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        fetchRooms();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, navigate]);

  const fetchRooms = async () => {
    const { data, error } = await supabase
      .from('rooms')
      .select(`
        *,
        room_players(count)
      `)
      .eq('is_private', false)
      .in('status', ['waiting'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching rooms:', error);
    } else {
      setRooms(data?.map(r => ({
        id: r.id,
        code: r.code,
        name: r.name,
        hostId: r.host_id,
        isPrivate: r.is_private,
        maxPlayers: r.max_players,
        status: r.status as Room['status'],
        createdAt: new Date(r.created_at),
        players: [],
      })) || []);
    }
    setLoading(false);
  };

  const createRoom = async () => {
    if (!user || !roomName.trim()) return;
    
    setCreating(true);
    
    // Generate room code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const { data, error } = await supabase
      .from('rooms')
      .insert({
        code,
        name: roomName.trim(),
        host_id: user.id,
        is_private: isPrivate,
        password: isPrivate ? password : null,
        max_players: parseInt(maxPlayers),
      })
      .select()
      .single();

    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível criar a sala.' });
    } else if (data) {
      // Join the room as host
      await supabase.from('room_players').insert({
        room_id: data.id,
        player_id: user.id,
        position: 0,
      });
      navigate(`/room/${data.id}`);
    }
    setCreating(false);
  };

  const joinRoom = async (roomId: string) => {
    if (!user) return;
    
    // Get current player count
    const { data: players } = await supabase
      .from('room_players')
      .select('position')
      .eq('room_id', roomId)
      .order('position', { ascending: false });

    const nextPosition = (players?.[0]?.position ?? -1) + 1;
    
    const { error } = await supabase.from('room_players').insert({
      room_id: roomId,
      player_id: user.id,
      position: nextPosition,
    });

    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível entrar na sala.' });
    } else {
      navigate(`/room/${roomId}`);
    }
  };

  const joinByCode = async () => {
    if (!joinCode.trim()) return;
    
    const { data, error } = await supabase
      .from('rooms')
      .select('id')
      .eq('code', joinCode.toUpperCase())
      .single();

    if (error || !data) {
      toast({ variant: 'destructive', title: 'Sala não encontrada', description: 'Verifique o código.' });
    } else {
      joinRoom(data.id);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (!user) return null;

  return (
    <div className="min-h-screen p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-game-table opacity-30" />
      
      <div className="relative z-10 max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          className="flex items-center justify-between mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold text-gradient-primary">Lobby</h1>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </motion.div>

        {/* Actions */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {/* Create Room */}
          <Dialog>
            <DialogTrigger asChild>
              <Button className="h-20 text-lg gap-3">
                <Plus className="w-6 h-6" />
                Criar Sala
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card border-white/10">
              <DialogHeader>
                <DialogTitle>Criar Nova Sala</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Nome da Sala</Label>
                  <Input
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="Minha sala"
                    className="glass-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Máximo de Jogadores</Label>
                  <Select value={maxPlayers} onValueChange={setMaxPlayers}>
                    <SelectTrigger className="glass-input">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2, 3, 4, 5, 6].map(n => (
                        <SelectItem key={n} value={n.toString()}>{n} jogadores</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Sala Privada</Label>
                  <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
                </div>
                {isPrivate && (
                  <div className="space-y-2">
                    <Label>Senha</Label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••"
                      className="glass-input"
                    />
                  </div>
                )}
                <Button onClick={createRoom} disabled={creating || !roomName.trim()} className="w-full">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Criar
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Join by Code */}
          <div className="glass-card rounded-xl p-4 flex gap-2">
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Código da sala"
              maxLength={6}
              className="glass-input uppercase"
            />
            <Button onClick={joinByCode} disabled={!joinCode.trim()}>
              <Key className="w-4 h-4 mr-2" />
              Entrar
            </Button>
          </div>
        </motion.div>

        {/* Room List */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Users className="w-5 h-5" />
              Salas Públicas
            </h2>
            <Button variant="ghost" size="sm" onClick={fetchRooms}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            </div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-8 glass-card rounded-xl">
              <p className="text-muted-foreground">Nenhuma sala disponível</p>
              <p className="text-sm text-muted-foreground">Crie uma nova sala para começar!</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {rooms.map((room) => (
                <motion.div
                  key={room.id}
                  className="glass-card rounded-xl p-4 flex items-center justify-between"
                  whileHover={{ scale: 1.01 }}
                >
                  <div className="flex items-center gap-3">
                    {room.isPrivate ? (
                      <Lock className="w-5 h-5 text-accent" />
                    ) : (
                      <Unlock className="w-5 h-5 text-primary" />
                    )}
                    <div>
                      <h3 className="font-medium">{room.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        Código: {room.code} • Máx: {room.maxPlayers}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => joinRoom(room.id)}>
                    Entrar
                  </Button>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Lobby;
