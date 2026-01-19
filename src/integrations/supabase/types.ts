export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          created_at: string | null
          id: string
          message: string
          player_id: string
          room_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          player_id: string
          room_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          player_id?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms_public"
            referencedColumns: ["id"]
          },
        ]
      }
      game_actions: {
        Row: {
          action_data: Json | null
          action_type: string
          created_at: string | null
          id: string
          player_id: string
          room_id: string
        }
        Insert: {
          action_data?: Json | null
          action_type: string
          created_at?: string | null
          id?: string
          player_id: string
          room_id: string
        }
        Update: {
          action_data?: Json | null
          action_type?: string
          created_at?: string | null
          id?: string
          player_id?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_actions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_actions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_actions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms_public"
            referencedColumns: ["id"]
          },
        ]
      }
      game_state: {
        Row: {
          deck: Json | null
          discard_pile: Json | null
          id: string
          last_action: Json | null
          phase: string | null
          player_hands: Json | null
          revealed_cards: Json | null
          room_id: string
          updated_at: string | null
        }
        Insert: {
          deck?: Json | null
          discard_pile?: Json | null
          id?: string
          last_action?: Json | null
          phase?: string | null
          player_hands?: Json | null
          revealed_cards?: Json | null
          room_id: string
          updated_at?: string | null
        }
        Update: {
          deck?: Json | null
          discard_pile?: Json | null
          id?: string
          last_action?: Json | null
          phase?: string | null
          player_hands?: Json | null
          revealed_cards?: Json | null
          room_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_state_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_state_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "rooms_public"
            referencedColumns: ["id"]
          },
        ]
      }
      join_attempts: {
        Row: {
          attempt_time: string | null
          id: string
          player_id: string
          room_id: string
          success: boolean
        }
        Insert: {
          attempt_time?: string | null
          id?: string
          player_id: string
          room_id: string
          success?: boolean
        }
        Update: {
          attempt_time?: string | null
          id?: string
          player_id?: string
          room_id?: string
          success?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          games_played: number | null
          games_won: number | null
          id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          games_played?: number | null
          games_won?: number | null
          id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          games_played?: number | null
          games_won?: number | null
          id?: string
          username?: string | null
        }
        Relationships: []
      }
      room_players: {
        Row: {
          id: string
          is_ready: boolean | null
          joined_at: string | null
          player_id: string
          position: number
          room_id: string
        }
        Insert: {
          id?: string
          is_ready?: boolean | null
          joined_at?: string | null
          player_id: string
          position: number
          room_id: string
        }
        Update: {
          id?: string
          is_ready?: boolean | null
          joined_at?: string | null
          player_id?: string
          position?: number
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms_public"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          code: string
          created_at: string | null
          current_turn: string | null
          dutch_caller: string | null
          host_id: string
          id: string
          is_private: boolean | null
          max_players: number | null
          name: string
          password: string | null
          status: string | null
          turn_started_at: string | null
        }
        Insert: {
          code?: string
          created_at?: string | null
          current_turn?: string | null
          dutch_caller?: string | null
          host_id: string
          id?: string
          is_private?: boolean | null
          max_players?: number | null
          name: string
          password?: string | null
          status?: string | null
          turn_started_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          current_turn?: string | null
          dutch_caller?: string | null
          host_id?: string
          id?: string
          is_private?: boolean | null
          max_players?: number | null
          name?: string
          password?: string | null
          status?: string | null
          turn_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_current_turn_fkey"
            columns: ["current_turn"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_dutch_caller_fkey"
            columns: ["dutch_caller"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      rooms_public: {
        Row: {
          code: string | null
          created_at: string | null
          current_turn: string | null
          dutch_caller: string | null
          host_id: string | null
          id: string | null
          is_private: boolean | null
          max_players: number | null
          name: string | null
          status: string | null
          turn_started_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          current_turn?: string | null
          dutch_caller?: string | null
          host_id?: string | null
          id?: string | null
          is_private?: boolean | null
          max_players?: number | null
          name?: string | null
          status?: string | null
          turn_started_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          current_turn?: string | null
          dutch_caller?: string | null
          host_id?: string | null
          id?: string | null
          is_private?: boolean | null
          max_players?: number | null
          name?: string | null
          status?: string | null
          turn_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_current_turn_fkey"
            columns: ["current_turn"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_dutch_caller_fkey"
            columns: ["dutch_caller"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      generate_room_code: { Args: never; Returns: string }
      verify_and_join_room:
        | {
            Args: {
              p_password: string
              p_player_id: string
              p_position: number
              p_room_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_password: string
              p_player_id: string
              p_position: number
              p_room_id: string
            }
            Returns: Json
          }
      verify_room_password: {
        Args: { hash: string; password: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
