-- Fix Function Search Path Mutable warnings by adding proper search_path

-- 1. Fix validate_room_name function
CREATE OR REPLACE FUNCTION validate_room_name()
RETURNS TRIGGER AS $$
BEGIN
  NEW.name := trim(NEW.name);
  IF length(NEW.name) < 1 OR length(NEW.name) > 100 THEN
    RAISE EXCEPTION 'Room name must be between 1 and 100 characters';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- 2. Fix hash_room_password_trigger function
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
$$ LANGUAGE plpgsql
SET search_path = public;

-- 3. Fix verify_room_password function
CREATE OR REPLACE FUNCTION verify_room_password(password TEXT, hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF password IS NULL OR hash IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN hash = crypt(password, hash);
END;
$$;