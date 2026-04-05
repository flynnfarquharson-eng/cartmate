export type Database = {
  public: {
    Tables: {
      houses: {
        Row: {
          id: string;
          name: string;
          address: string;
          invite_code: string;
          store_chain: string | null;
          store_name: string | null;
          store_no: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address: string;
          invite_code: string;
          store_chain?: string | null;
          store_name?: string | null;
          store_no?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          address?: string;
          invite_code?: string;
          store_chain?: string | null;
          store_name?: string | null;
          store_no?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      members: {
        Row: {
          id: string;
          house_id: string;
          name: string;
          email: string;
          avatar_color: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          house_id: string;
          name: string;
          email: string;
          avatar_color: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          house_id?: string;
          name?: string;
          email?: string;
          avatar_color?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "members_house_id_fkey";
            columns: ["house_id"];
            isOneToOne: false;
            referencedRelation: "houses";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          house_id: string;
          status: "open" | "locked" | "confirmed";
          created_at: string;
        };
        Insert: {
          id?: string;
          house_id: string;
          status?: "open" | "locked" | "confirmed";
          created_at?: string;
        };
        Update: {
          id?: string;
          house_id?: string;
          status?: "open" | "locked" | "confirmed";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_house_id_fkey";
            columns: ["house_id"];
            isOneToOne: false;
            referencedRelation: "houses";
            referencedColumns: ["id"];
          },
        ];
      };
      items: {
        Row: {
          id: string;
          order_id: string;
          member_id: string;
          name: string;
          price: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          member_id: string;
          name: string;
          price: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          member_id?: string;
          name?: string;
          price?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "items_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          order_id: string;
          member_id: string;
          amount: number;
          stripe_payment_intent_id: string;
          status: "pending" | "paid";
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          member_id: string;
          amount: number;
          stripe_payment_intent_id: string;
          status?: "pending" | "paid";
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          member_id?: string;
          amount?: number;
          stripe_payment_intent_id?: string;
          status?: "pending" | "paid";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type House = Database["public"]["Tables"]["houses"]["Row"];
export type Member = Database["public"]["Tables"]["members"]["Row"];
export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type Item = Database["public"]["Tables"]["items"]["Row"];
export type Payment = Database["public"]["Tables"]["payments"]["Row"];
