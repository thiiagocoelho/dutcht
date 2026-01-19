-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Add room name validation trigger (using trigger instead of CHECK for flexibility)
CREATE OR REPLACE FUNCTION validate_room_name()
RETURNS TRIGGER AS $$
BEGIN
  NEW.name := trim(NEW.name);
  IF length(NEW.name) < 1 OR length(NEW.name) > 100 THEN
    RAISE EXCEPTION 'Room name must be between 1 and 100 characters';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_room_name_trigger
BEFORE INSERT OR UPDATE OF name ON public.rooms
FOR EACH ROW EXECUTE FUNCTION validate_room_name();

-- 2. Add default for room code using the secure server-side function
ALTER TABLE public.rooms 
ALTER COLUMN code SET DEFAULT generate_room_code();

-- 3. Add password hashing trigger for room passwords
CREATE OR REPLACE FUNCTION hash_room_password_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.password IS NOT NULL AND NEW.password != '' THEN
    -- Only hash if it doesn't look like a bcrypt hash already
    IF NOT (NEW.password LIKE '$2%') THEN
      NEW.password := crypt(NEW.password, gen_salt('bf'));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hash_room_password_before_insert
BEFORE INSERT OR UPDATE OF password ON public.rooms
FOR EACH ROW
WHEN (NEW.password IS NOT NULL)
EXECUTE FUNCTION hash_room_password_trigger();

-- 4. Create helper function for password verification  
CREATE OR REPLACE FUNCTION verify_room_password(password TEXT, hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  IF password IS NULL OR hash IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN hash = crypt(password, hash);
END;
$$;

-- 5. Update verify_and_join_room to use the new password verification
CREATE OR REPLACE FUNCTION public.verify_and_join_room(p_room_id uuid, p_password text, p_player_id uuid, p_position integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_room_password TEXT;
  v_is_private BOOLEAN;
  v_max_players INTEGER;
  v_current_count INTEGER;
  v_existing_player UUID;
  v_recent_failed_attempts INTEGER;
  v_room_status TEXT;
BEGIN
  -- Verify the caller is the player trying to join
  IF auth.uid() != p_player_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

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
  SELECT password, is_private, max_players, status
  INTO v_room_password, v_is_private, v_max_players, v_room_status
  FROM rooms
  WHERE id = p_room_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Room not found');
  END IF;

  -- Check if room is still accepting players
  IF v_room_status != 'waiting' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Room is not accepting players');
  END IF;

  -- Check password for private rooms using secure hash comparison
  IF v_is_private AND v_room_password IS NOT NULL THEN
    IF p_password IS NULL OR NOT verify_room_password(p_password, v_room_password) THEN
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
$function$;