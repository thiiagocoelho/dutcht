-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Room host can manage game state" ON public.game_state;

-- Create policies that allow all room players to update game state during their turn
CREATE POLICY "Room players can update game state"
ON public.game_state
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM room_players rp
    WHERE rp.room_id = game_state.room_id 
    AND rp.player_id = auth.uid()
  )
);

-- Allow host to insert game state
CREATE POLICY "Host can insert game state"
ON public.game_state
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM rooms r
    WHERE r.id = room_id 
    AND r.host_id = auth.uid()
  )
);

-- Allow room players to delete (for cleanup)
CREATE POLICY "Host can delete game state"
ON public.game_state
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM rooms r
    WHERE r.id = game_state.room_id 
    AND r.host_id = auth.uid()
  )
);

-- Allow all room players to update the rooms table for turn management
DROP POLICY IF EXISTS "Hosts can update their rooms" ON public.rooms;

CREATE POLICY "Room players can update turn info"
ON public.rooms
FOR UPDATE
USING (
  auth.uid() = host_id
  OR EXISTS (
    SELECT 1 FROM room_players rp
    WHERE rp.room_id = rooms.id
    AND rp.player_id = auth.uid()
  )
);