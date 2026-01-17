import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Card {
  suit: string;
  value: string;
}

interface GameStateRow {
  id: string;
  room_id: string;
  phase: string | null;
  deck: Card[] | null;
  discard_pile: Card[] | null;
  player_hands: Record<string, Card[]> | null;
  revealed_cards: Record<string, number[]> | null;
  last_action: unknown | null;
  updated_at: string | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get room_id from request body
    const { room_id } = await req.json();
    
    if (!room_id) {
      return new Response(
        JSON.stringify({ error: 'room_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is in the room
    const { data: roomPlayer, error: roomPlayerError } = await supabase
      .from('room_players')
      .select('id')
      .eq('room_id', room_id)
      .eq('player_id', user.id)
      .maybeSingle();

    if (roomPlayerError) {
      console.error('Room player check error:', roomPlayerError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify room membership' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!roomPlayer) {
      return new Response(
        JSON.stringify({ error: 'You are not a member of this room' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the full game state using service role (bypasses RLS)
    const { data: gameState, error: gameStateError } = await supabase
      .from('game_state')
      .select('*')
      .eq('room_id', room_id)
      .maybeSingle();

    if (gameStateError) {
      console.error('Game state fetch error:', gameStateError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch game state' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!gameState) {
      return new Response(
        JSON.stringify({ data: null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const typedGameState = gameState as GameStateRow;

    // Filter the game state to only include the current player's hand details
    // Other players' hands are returned as card backs (count only, no values)
    const filteredPlayerHands: Record<string, { cards: Card[] | null; cardCount: number }> = {};
    const playerHands = typedGameState.player_hands || {};
    
    for (const [playerId, cards] of Object.entries(playerHands)) {
      if (playerId === user.id) {
        // Current player can see their own cards
        filteredPlayerHands[playerId] = {
          cards: cards as Card[],
          cardCount: (cards as Card[])?.length || 0,
        };
      } else {
        // Other players - only show card count, not the actual cards
        filteredPlayerHands[playerId] = {
          cards: null,
          cardCount: (cards as Card[])?.length || 0,
        };
      }
    }

    // Filter revealed cards - only show revealed cards during memorizing phase for the current player
    const filteredRevealedCards: Record<string, number[]> = {};
    const revealedCards = typedGameState.revealed_cards || {};
    
    if (typedGameState.phase === 'memorizing') {
      // During memorizing, only show the current player's revealed cards
      if (revealedCards[user.id]) {
        filteredRevealedCards[user.id] = revealedCards[user.id];
      }
    }
    // After memorizing, no cards are revealed to anyone

    // Return the filtered game state
    const safeGameState = {
      id: typedGameState.id,
      room_id: typedGameState.room_id,
      phase: typedGameState.phase,
      deck_count: typedGameState.deck?.length || 0, // Only return count, not contents
      discard_pile: typedGameState.discard_pile, // Top of discard is public knowledge
      player_hands: filteredPlayerHands,
      revealed_cards: filteredRevealedCards,
      last_action: typedGameState.last_action,
      updated_at: typedGameState.updated_at,
    };

    console.log(`Game state fetched for user ${user.id} in room ${room_id}`);

    return new Response(
      JSON.stringify({ data: safeGameState }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
