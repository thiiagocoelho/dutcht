-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  avatar_url TEXT,
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Create trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'username');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create rooms table
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  host_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  is_private BOOLEAN DEFAULT false,
  password TEXT,
  max_players INTEGER DEFAULT 4 CHECK (max_players >= 2 AND max_players <= 6),
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  current_turn UUID REFERENCES public.profiles(id),
  turn_started_at TIMESTAMP WITH TIME ZONE,
  dutch_caller UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on rooms
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Rooms policies
CREATE POLICY "Rooms are viewable by everyone" ON public.rooms
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create rooms" ON public.rooms
  FOR INSERT WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can update their rooms" ON public.rooms
  FOR UPDATE USING (auth.uid() = host_id);

CREATE POLICY "Hosts can delete their rooms" ON public.rooms
  FOR DELETE USING (auth.uid() = host_id);

-- Create room_players table (for tracking players in rooms)
CREATE TABLE public.room_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  position INTEGER NOT NULL,
  is_ready BOOLEAN DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(room_id, player_id),
  UNIQUE(room_id, position)
);

-- Enable RLS on room_players
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;

-- Room players policies
CREATE POLICY "Room players are viewable by everyone" ON public.room_players
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can join rooms" ON public.room_players
  FOR INSERT WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Players can update their own status" ON public.room_players
  FOR UPDATE USING (auth.uid() = player_id);

CREATE POLICY "Players can leave rooms" ON public.room_players
  FOR DELETE USING (auth.uid() = player_id);

-- Create game_state table (stores complete game state as JSONB)
CREATE TABLE public.game_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE UNIQUE NOT NULL,
  deck JSONB DEFAULT '[]'::jsonb,
  discard_pile JSONB DEFAULT '[]'::jsonb,
  player_hands JSONB DEFAULT '{}'::jsonb,
  revealed_cards JSONB DEFAULT '{}'::jsonb,
  phase TEXT DEFAULT 'memorizing' CHECK (phase IN ('memorizing', 'playing', 'dutch_round', 'finished')),
  last_action JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on game_state
ALTER TABLE public.game_state ENABLE ROW LEVEL SECURITY;

-- Game state policies (only players in the room can see)
CREATE POLICY "Game state viewable by room players" ON public.game_state
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.room_players rp
      WHERE rp.room_id = game_state.room_id
      AND rp.player_id = auth.uid()
    )
  );

CREATE POLICY "Room host can manage game state" ON public.game_state
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.rooms r
      WHERE r.id = game_state.room_id
      AND r.host_id = auth.uid()
    )
  );

-- Create game_actions table (for action log)
CREATE TABLE public.game_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  action_type TEXT NOT NULL,
  action_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on game_actions
ALTER TABLE public.game_actions ENABLE ROW LEVEL SECURITY;

-- Game actions policies
CREATE POLICY "Game actions viewable by room players" ON public.game_actions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.room_players rp
      WHERE rp.room_id = game_actions.room_id
      AND rp.player_id = auth.uid()
    )
  );

CREATE POLICY "Players can insert their own actions" ON public.game_actions
  FOR INSERT WITH CHECK (auth.uid() = player_id);

-- Create chat_messages table
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on chat_messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Chat messages policies
CREATE POLICY "Chat messages viewable by room players" ON public.chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.room_players rp
      WHERE rp.room_id = chat_messages.room_id
      AND rp.player_id = auth.uid()
    )
  );

CREATE POLICY "Players can send messages" ON public.chat_messages
  FOR INSERT WITH CHECK (auth.uid() = player_id);

-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_actions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Generate random room code function
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  code TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    code := upper(substring(md5(random()::text) from 1 for 6));
    SELECT EXISTS(SELECT 1 FROM public.rooms WHERE rooms.code = code) INTO exists_check;
    EXIT WHEN NOT exists_check;
  END LOOP;
  RETURN code;
END;
$$;