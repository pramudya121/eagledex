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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      indexer_cursor: {
        Row: {
          chain_id: number
          last_block: number
          updated_at: string
        }
        Insert: {
          chain_id: number
          last_block?: number
          updated_at?: string
        }
        Update: {
          chain_id?: number
          last_block?: number
          updated_at?: string
        }
        Relationships: []
      }
      pair_events: {
        Row: {
          amount0: number | null
          amount0_in: number | null
          amount0_out: number | null
          amount1: number | null
          amount1_in: number | null
          amount1_out: number | null
          block_number: number
          block_ts: string
          chain_id: number
          created_at: string
          event_type: string
          id: number
          log_index: number
          pair: string
          reserve0: number | null
          reserve1: number | null
          sender: string | null
          to_addr: string | null
          token0: string | null
          token1: string | null
          tx_hash: string
        }
        Insert: {
          amount0?: number | null
          amount0_in?: number | null
          amount0_out?: number | null
          amount1?: number | null
          amount1_in?: number | null
          amount1_out?: number | null
          block_number: number
          block_ts: string
          chain_id: number
          created_at?: string
          event_type: string
          id?: number
          log_index: number
          pair: string
          reserve0?: number | null
          reserve1?: number | null
          sender?: string | null
          to_addr?: string | null
          token0?: string | null
          token1?: string | null
          tx_hash: string
        }
        Update: {
          amount0?: number | null
          amount0_in?: number | null
          amount0_out?: number | null
          amount1?: number | null
          amount1_in?: number | null
          amount1_out?: number | null
          block_number?: number
          block_ts?: string
          chain_id?: number
          created_at?: string
          event_type?: string
          id?: number
          log_index?: number
          pair?: string
          reserve0?: number | null
          reserve1?: number | null
          sender?: string | null
          to_addr?: string | null
          token0?: string | null
          token1?: string | null
          tx_hash?: string
        }
        Relationships: []
      }
      pairs_state: {
        Row: {
          chain_id: number
          created_block: number | null
          decimals0: number
          decimals1: number
          pair: string
          reserve0: number
          reserve1: number
          symbol0: string | null
          symbol1: string | null
          token0: string
          token1: string
          total_supply: number
          updated_at: string
        }
        Insert: {
          chain_id: number
          created_block?: number | null
          decimals0?: number
          decimals1?: number
          pair: string
          reserve0?: number
          reserve1?: number
          symbol0?: string | null
          symbol1?: string | null
          token0: string
          token1: string
          total_supply?: number
          updated_at?: string
        }
        Update: {
          chain_id?: number
          created_block?: number | null
          decimals0?: number
          decimals1?: number
          pair?: string
          reserve0?: number
          reserve1?: number
          symbol0?: string | null
          symbol1?: string | null
          token0?: string
          token1?: string
          total_supply?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      pair_volume_24h: {
        Row: {
          pair: string | null
          swap_count: number | null
          volume0: number | null
          volume1: number | null
        }
        Relationships: []
      }
      pair_volume_7d: {
        Row: {
          pair: string | null
          swap_count: number | null
          volume0: number | null
          volume1: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
