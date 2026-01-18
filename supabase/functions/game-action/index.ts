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

type ActionType = 'draw' | 'swap' | 'discard';

interface ActionPayload {
  room_id: string;
  action: ActionType;
  source?: 'deck' | 'discard';
  hand_index?: number;
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

    const payload: ActionPayload = await req.json();
    const { room_id, action, source, hand_index } = payload;
    
    if (!room_id || !action) {
      return new Response(
        JSON.stringify({ error: 'room_id and action are required' }),
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

    if (roomPlayerError || !roomPlayer) {
      console.error('Room player check error:', roomPlayerError);
      return new Response(
        JSON.stringify({ error: 'You are not a member of this room' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if it's the player's turn
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('current_turn, status')
      .eq('id', room_id)
      .single();

    if (roomError || !room) {
      return new Response(
        JSON.stringify({ error: 'Room not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (room.current_turn !== user.id) {
      return new Response(
        JSON.stringify({ error: 'It is not your turn' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (room.status !== 'playing') {
      return new Response(
        JSON.stringify({ error: 'Game is not in playing state' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the full game state
    const { data: gameState, error: gameStateError } = await supabase
      .from('game_state')
      .select('*')
      .eq('room_id', room_id)
      .single();

    if (gameStateError || !gameState) {
      console.error('Game state fetch error:', gameStateError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch game state' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const typedGameState = gameState as GameStateRow;
    let result: { drawnCard?: Card; success: boolean; error?: string } = { success: false };

    switch (action) {
      case 'draw': {
        if (!source) {
          return new Response(
            JSON.stringify({ error: 'source is required for draw action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const pile = source === 'deck' ? typedGameState.deck : typedGameState.discard_pile;
        if (!pile || pile.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Pile is empty' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const drawnCard = pile[pile.length - 1];
        
        // Log action
        await supabase.from('game_actions').insert({
          room_id,
          player_id: user.id,
          action_type: 'draw',
          action_data: { source },
        });

        result = { success: true, drawnCard };
        console.log(`Player ${user.id} drew card from ${source}`);
        break;
      }

      case 'swap': {
        if (hand_index === undefined || hand_index < 0) {
          return new Response(
            JSON.stringify({ error: 'hand_index is required for swap action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get the drawn card from the request (client tracks which card was drawn)
        const { drawn_card, drawn_source } = payload as ActionPayload & { drawn_card: Card; drawn_source: 'deck' | 'discard' };
        
        if (!drawn_card || !drawn_source) {
          return new Response(
            JSON.stringify({ error: 'drawn_card and drawn_source are required for swap' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const playerHands = typedGameState.player_hands || {};
        const myHand = playerHands[user.id] || [];
        
        if (hand_index >= myHand.length) {
          return new Response(
            JSON.stringify({ error: 'Invalid hand index' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const swappedCard = myHand[hand_index];
        const newHand = [...myHand];
        newHand[hand_index] = drawn_card;

        const newPlayerHands = {
          ...playerHands,
          [user.id]: newHand,
        };

        let newDeck = typedGameState.deck || [];
        let newDiscardPile = typedGameState.discard_pile || [];

        if (drawn_source === 'deck') {
          newDeck = newDeck.slice(0, -1);
          newDiscardPile = [...newDiscardPile, swappedCard];
        } else {
          newDiscardPile = [...newDiscardPile.slice(0, -1), swappedCard];
        }

        const { error: updateError } = await supabase
          .from('game_state')
          .update({
            deck: newDeck,
            discard_pile: newDiscardPile,
            player_hands: newPlayerHands,
            updated_at: new Date().toISOString(),
          })
          .eq('room_id', room_id);

        if (updateError) {
          console.error('Error updating game state:', updateError);
          return new Response(
            JSON.stringify({ error: 'Failed to update game state' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Log action
        await supabase.from('game_actions').insert({
          room_id,
          player_id: user.id,
          action_type: 'swap',
        });

        // Advance turn
        await advanceTurn(supabase, room_id);

        result = { success: true };
        console.log(`Player ${user.id} swapped card at index ${hand_index}`);
        break;
      }

      case 'discard': {
        const { drawn_card, drawn_source } = payload as ActionPayload & { drawn_card: Card; drawn_source: 'deck' | 'discard' };
        
        if (!drawn_card || !drawn_source) {
          return new Response(
            JSON.stringify({ error: 'drawn_card and drawn_source are required for discard' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let newDeck = typedGameState.deck || [];
        let newDiscardPile = typedGameState.discard_pile || [];

        if (drawn_source === 'deck') {
          newDeck = newDeck.slice(0, -1);
          newDiscardPile = [...newDiscardPile, drawn_card];
        }
        // If from discard, it stays there

        const { error: updateError } = await supabase
          .from('game_state')
          .update({
            deck: newDeck,
            discard_pile: newDiscardPile,
            updated_at: new Date().toISOString(),
          })
          .eq('room_id', room_id);

        if (updateError) {
          console.error('Error updating game state:', updateError);
          return new Response(
            JSON.stringify({ error: 'Failed to update game state' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Log action
        await supabase.from('game_actions').insert({
          room_id,
          player_id: user.id,
          action_type: 'discard',
        });

        // Advance turn
        await advanceTurn(supabase, room_id);

        result = { success: true };
        console.log(`Player ${user.id} discarded drawn card`);
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify(result),
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

// deno-lint-ignore no-explicit-any
async function advanceTurn(supabase: any, room_id: string) {
  // Get room and players
  const { data: room } = await supabase
    .from('rooms')
    .select('current_turn, dutch_caller')
    .eq('id', room_id)
    .single();

  const { data: players } = await supabase
    .from('room_players')
    .select('player_id')
    .eq('room_id', room_id)
    .order('position');

  if (!room || !players || players.length === 0) return;

  const playerList = players as { player_id: string }[];
  const roomData = room as { current_turn: string; dutch_caller: string | null };

  const currentIndex = playerList.findIndex(p => p.player_id === roomData.current_turn);
  const nextIndex = (currentIndex + 1) % playerList.length;
  const nextPlayer = playerList[nextIndex];

  // Check if Dutch round is complete
  if (roomData.dutch_caller && nextPlayer.player_id === roomData.dutch_caller) {
    // End game
    await supabase
      .from('game_state')
      .update({ phase: 'finished', updated_at: new Date().toISOString() })
      .eq('room_id', room_id);

    await supabase
      .from('rooms')
      .update({ status: 'finished' })
      .eq('id', room_id);
    return;
  }

  // Advance to next player
  await supabase
    .from('rooms')
    .update({
      current_turn: nextPlayer.player_id,
      turn_started_at: new Date().toISOString(),
    })
    .eq('id', room_id);
}
