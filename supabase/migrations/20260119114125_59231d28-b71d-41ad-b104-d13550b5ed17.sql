-- Fix the security definer view issue by recreating with security_invoker
DROP VIEW IF EXISTS public.rooms_public;

CREATE VIEW public.rooms_public
WITH (security_invoker = on) AS
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

-- Re-grant select access on the view
GRANT SELECT ON public.rooms_public TO authenticated;
GRANT SELECT ON public.rooms_public TO anon;