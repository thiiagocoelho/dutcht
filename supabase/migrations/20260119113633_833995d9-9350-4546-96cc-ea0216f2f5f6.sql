-- Create a public view for rooms that excludes the password column
CREATE VIEW public.rooms_public AS
SELECT
  id,
  code,
  name,
  host_id,
  is_private,
  max_players,
  status,
  created_at,
  current_turn,
  turn_started_at,
  dutch_caller
FROM public.rooms;

-- Grant select access on the view to authenticated and anon roles
GRANT SELECT ON public.rooms_public TO authenticated;
GRANT SELECT ON public.rooms_public TO anon;

-- Drop the existing permissive SELECT policy on rooms
DROP POLICY IF EXISTS "Rooms are viewable by everyone" ON public.rooms;

-- Create a restrictive SELECT policy - only host can see their own rooms (for password access during creation)
-- All other reads go through the view
CREATE POLICY "Only host can read own room"
ON public.rooms
FOR SELECT
USING (auth.uid() = host_id);