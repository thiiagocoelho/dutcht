-- Fix the generate_room_code function to set search_path
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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