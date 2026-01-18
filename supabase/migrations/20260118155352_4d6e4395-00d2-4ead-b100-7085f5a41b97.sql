-- Create join_attempts table for rate limiting
CREATE TABLE public.join_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL,
  room_id UUID NOT NULL,
  attempt_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
  success BOOLEAN NOT NULL DEFAULT false
);

-- Create index for efficient lookups
CREATE INDEX idx_join_attempts_lookup ON public.join_attempts(player_id, room_id, attempt_time);

-- Enable RLS
ALTER TABLE public.join_attempts ENABLE ROW LEVEL SECURITY;

-- Players can only insert their own attempts (tracked automatically)
CREATE POLICY "Players can insert their own attempts"
ON public.join_attempts
FOR INSERT
WITH CHECK (auth.uid() = player_id);

-- Players can view their own attempts (for debugging/user feedback)
CREATE POLICY "Players can view their own attempts"
ON public.join_attempts
FOR SELECT
USING (auth.uid() = player_id);

-- Drop the existing function first
DROP FUNCTION IF EXISTS public.verify_and_join_room(UUID, TEXT, UUID, INTEGER);

-- Recreate verify_and_join_room with rate limiting
CREATE OR REPLACE FUNCTION public.verify_and_join_room(
  p_room_id UUID,
  p_password TEXT,
  p_player_id UUID,
  p_position INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_password TEXT;
  v_is_private BOOLEAN;
  v_max_players INTEGER;
  v_current_count INTEGER;
  v_existing_player UUID;
  v_recent_failed_attempts INTEGER;
BEGIN
  -- Rate limiting: Check recent failed attempts (last 5 minutes)
  SELECT COUNT(*) INTO v_recent_failed_attempts
  FROM join_attempts
  WHERE player_id = p_player_id
    AND room_id = p_room_id
    AND attempt_time > now() - interval '5 minutes'
    AND success = false;
  
  IF v_recent_failed_attempts >= 5 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Too many failed attempts. Please wait 5 minutes before trying again.'
    );
  END IF;

  -- Check if player already in room
  SELECT id INTO v_existing_player
  FROM room_players
  WHERE room_id = p_room_id AND player_id = p_player_id;
  
  IF v_existing_player IS NOT NULL THEN
    -- Already in room, consider this a success
    INSERT INTO join_attempts (player_id, room_id, success)
    VALUES (p_player_id, p_room_id, true);
    
    RETURN jsonb_build_object('success', true, 'message', 'Already in room');
  END IF;

  -- Get room details
  SELECT password, is_private, max_players
  INTO v_room_password, v_is_private, v_max_players
  FROM rooms
  WHERE id = p_room_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Room not found');
  END IF;

  -- Check password for private rooms
  IF v_is_private AND v_room_password IS NOT NULL THEN
    IF p_password IS NULL OR v_room_password != p_password THEN
      -- Log failed attempt
      INSERT INTO join_attempts (player_id, room_id, success)
      VALUES (p_player_id, p_room_id, false);
      
      RETURN jsonb_build_object('success', false, 'error', 'Invalid password');
    END IF;
  END IF;

  -- Check room capacity
  SELECT COUNT(*) INTO v_current_count
  FROM room_players
  WHERE room_id = p_room_id;
  
  IF v_current_count >= v_max_players THEN
    RETURN jsonb_build_object('success', false, 'error', 'Room is full');
  END IF;

  -- Join the room
  INSERT INTO room_players (room_id, player_id, position)
  VALUES (p_room_id, p_player_id, p_position);
  
  -- Log successful attempt
  INSERT INTO join_attempts (player_id, room_id, success)
  VALUES (p_player_id, p_room_id, true);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Drop the existing SELECT policy on game_state that exposes all data
DROP POLICY IF EXISTS "Game state viewable by room players" ON public.game_state;

-- Create a restrictive SELECT policy that returns no direct data
-- Players must use the edge function to get filtered game state
CREATE POLICY "Game state not directly readable"
ON public.game_state
FOR SELECT
USING (false);