// Generated from the migrations in supabase/migrations.
// Regenerate after schema changes: npm run db:types -w @frontdesk/db
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      appointments: {
        Row: {
          id: string;
          business_id: string;
          service_id: string;
          staff_id: string;
          customer_id: string | null;
          starts_at: string;
          ends_at: string;
          status: Database["public"]["Enums"]["appointment_status"];
          source: Database["public"]["Enums"]["booking_source"];
          amount_paise: number;
          hold_expires_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          service_id: string;
          staff_id: string;
          customer_id?: string | null;
          starts_at: string;
          ends_at: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          source: Database["public"]["Enums"]["booking_source"];
          amount_paise?: number;
          hold_expires_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          service_id?: string;
          staff_id?: string;
          customer_id?: string | null;
          starts_at?: string;
          ends_at?: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          source?: Database["public"]["Enums"]["booking_source"];
          amount_paise?: number;
          hold_expires_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      availability_rules: {
        Row: {
          id: string;
          business_id: string;
          staff_id: string | null;
          weekday: number;
          start_time: string;
          end_time: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          staff_id?: string | null;
          weekday: number;
          start_time: string;
          end_time: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          staff_id?: string | null;
          weekday?: number;
          start_time?: string;
          end_time?: string;
        };
        Relationships: [];
      };
      businesses: {
        Row: {
          id: string;
          slug: string;
          name: string;
          vertical: Database["public"]["Enums"]["business_vertical"];
          area: string | null;
          address: string | null;
          phone: string | null;
          timezone: string;
          accent_color: string;
          ai_enabled: boolean;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          vertical?: Database["public"]["Enums"]["business_vertical"];
          area?: string | null;
          address?: string | null;
          phone?: string | null;
          timezone?: string;
          accent_color?: string;
          ai_enabled?: boolean;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          vertical?: Database["public"]["Enums"]["business_vertical"];
          area?: string | null;
          address?: string | null;
          phone?: string | null;
          timezone?: string;
          accent_color?: string;
          ai_enabled?: boolean;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      chunks: {
        Row: {
          id: number;
          business_id: string;
          document_id: string;
          content: string;
          embedding: string | null;
          fts: unknown | null;
          chunk_index: number;
          page: number | null;
          created_at: string;
        };
        Insert: {
          id?: never;
          business_id: string;
          document_id: string;
          content: string;
          embedding?: string | null;
          fts?: never;
          chunk_index?: number;
          page?: number | null;
          created_at?: string;
        };
        Update: {
          id?: never;
          business_id?: string;
          document_id?: string;
          content?: string;
          embedding?: string | null;
          fts?: never;
          chunk_index?: number;
          page?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          business_id: string;
          customer_id: string | null;
          channel: Database["public"]["Enums"]["channel"];
          status: Database["public"]["Enums"]["conversation_status"];
          last_message_at: string;
          cost_usd: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          customer_id?: string | null;
          channel: Database["public"]["Enums"]["channel"];
          status?: Database["public"]["Enums"]["conversation_status"];
          last_message_at?: string;
          cost_usd?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          customer_id?: string | null;
          channel?: Database["public"]["Enums"]["channel"];
          status?: Database["public"]["Enums"]["conversation_status"];
          last_message_at?: string;
          cost_usd?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          business_id: string;
          phone: string | null;
          name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          phone?: string | null;
          name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          phone?: string | null;
          name?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          kind: Database["public"]["Enums"]["document_kind"];
          storage_path: string | null;
          source_url: string | null;
          status: Database["public"]["Enums"]["document_status"];
          error: string | null;
          chunk_count: number;
          content: string | null;
          size_bytes: number | null;
          embedding_model: string | null;
          attempts: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          kind: Database["public"]["Enums"]["document_kind"];
          storage_path?: string | null;
          source_url?: string | null;
          status?: Database["public"]["Enums"]["document_status"];
          error?: string | null;
          chunk_count?: number;
          content?: string | null;
          size_bytes?: number | null;
          embedding_model?: string | null;
          attempts?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          kind?: Database["public"]["Enums"]["document_kind"];
          storage_path?: string | null;
          source_url?: string | null;
          status?: Database["public"]["Enums"]["document_status"];
          error?: string | null;
          chunk_count?: number;
          content?: string | null;
          size_bytes?: number | null;
          embedding_model?: string | null;
          attempts?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      members: {
        Row: {
          business_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["member_role"];
          created_at: string;
        };
        Insert: {
          business_id: string;
          user_id: string;
          role?: Database["public"]["Enums"]["member_role"];
          created_at?: string;
        };
        Update: {
          business_id?: string;
          user_id?: string;
          role?: Database["public"]["Enums"]["member_role"];
          created_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          business_id: string;
          conversation_id: string;
          role: Database["public"]["Enums"]["message_role"];
          content: string;
          metadata: Json;
          model: string | null;
          input_tokens: number | null;
          output_tokens: number | null;
          cost_usd: number | null;
          external_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          conversation_id: string;
          role: Database["public"]["Enums"]["message_role"];
          content: string;
          metadata?: Json;
          model?: string | null;
          input_tokens?: number | null;
          output_tokens?: number | null;
          cost_usd?: number | null;
          external_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          conversation_id?: string;
          role?: Database["public"]["Enums"]["message_role"];
          content?: string;
          metadata?: Json;
          model?: string | null;
          input_tokens?: number | null;
          output_tokens?: number | null;
          cost_usd?: number | null;
          external_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          business_id: string;
          appointment_id: string;
          provider_link_id: string | null;
          amount_paise: number;
          status: Database["public"]["Enums"]["payment_status"];
          paid_at: string | null;
          raw: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          appointment_id: string;
          provider_link_id?: string | null;
          amount_paise: number;
          status?: Database["public"]["Enums"]["payment_status"];
          paid_at?: string | null;
          raw?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          appointment_id?: string;
          provider_link_id?: string | null;
          amount_paise?: number;
          status?: Database["public"]["Enums"]["payment_status"];
          paid_at?: string | null;
          raw?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      service_staff: {
        Row: {
          business_id: string;
          service_id: string;
          staff_id: string;
        };
        Insert: {
          business_id: string;
          service_id: string;
          staff_id: string;
        };
        Update: {
          business_id?: string;
          service_id?: string;
          staff_id?: string;
        };
        Relationships: [];
      };
      services: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          description: string | null;
          duration_min: number;
          price_paise: number;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          description?: string | null;
          duration_min: number;
          price_paise?: number;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          description?: string | null;
          duration_min?: number;
          price_paise?: number;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      staff: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          title: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          title?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          title?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      create_business_with_setup: { Args: { payload: Json }; Returns: string };
      update_business_setup: { Args: { target: string; payload: Json }; Returns: undefined };
      is_member: { Args: { target: string }; Returns: boolean };
      is_owner: { Args: { target: string }; Returns: boolean };
      search_chunks: {
        Args: { p_business_id: string; p_terms: string[]; p_embedding?: string | null; p_limit?: number };
        Returns: Array<{
          id: number;
          document_id: string;
          document_name: string;
          page: number | null;
          content: string;
          keyword_rank: number | null;
          vector_rank: number | null;
          score: number;
        }>;
      };
    };
    Enums: {
      appointment_status: "pending_payment" | "confirmed" | "completed" | "cancelled" | "no_show";
      booking_source: "web" | "whatsapp" | "dashboard" | "walk_in";
      business_vertical: "clinic" | "salon" | "coaching" | "other";
      channel: "web" | "whatsapp";
      conversation_status: "ai" | "needs_human" | "human" | "resolved";
      document_kind: "pdf" | "url" | "text";
      document_status: "pending" | "processing" | "ready" | "failed";
      member_role: "owner" | "staff";
      message_role: "customer" | "ai" | "owner" | "tool";
      payment_status: "created" | "paid" | "expired" | "cancelled";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
