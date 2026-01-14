-- Create a secure function to verify password and join room
-- This prevents bypassing password protection by doing server-side verification
CREATE OR REPLACE FUNCTION public.verify_and_join_room(
  p_room_id UUID,
  p_player_id UUID,
  p_password TEXT,
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
  v_room_status TEXT;
  v_max_players INTEGER;
  v_current_count INTEGER;
BEGIN
  -- Verify the caller is the player trying to join
  IF auth.uid() != p_player_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Get room details
  SELECT password, is_private, status, max_players 
  INTO v_room_password, v_is_private, v_room_status, v_max_players
  FROM rooms WHERE id = p_room_id;
  
  -- Check if room exists
  IF v_room_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Room not found');
  END IF;
  
  -- Check if room is still accepting players
  IF v_room_status != 'waiting' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Room is not accepting players');
  END IF;
  
  -- Check password for private rooms
  IF v_is_private AND (v_room_password IS NULL OR v_room_password != p_password) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid password');
  END IF;
  
  -- Check if room is full
  SELECT COUNT(*) INTO v_current_count FROM room_players WHERE room_id = p_room_id;
  IF v_current_count >= v_max_players THEN
    RETURN jsonb_build_object('success', false, 'error', 'Room is full');
  END IF;
  
  -- Check if player is already in the room
  IF EXISTS (SELECT 1 FROM room_players WHERE room_id = p_room_id AND player_id = p_player_id) THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already in room');
  END IF;
  
  -- Insert player into room
  INSERT INTO room_players (room_id, player_id, position)
  VALUES (p_room_id, p_player_id, p_position);
  
  RETURN jsonb_build_object('success', true);
END;
$$;