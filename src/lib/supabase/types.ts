/**
 * Hand-maintained Supabase database types for BubanGo.
 *
 * Mirrors `supabase/schema.sql`. Kept in sync manually for the MVP; once the
 * Supabase CLI is wired up these can be replaced with
 * `supabase gen types typescript --linked > src/lib/supabase/types.ts`.
 *
 * Naming: snake_case here (DB) ↔ camelCase in `src/types` (app). Conversion
 * happens in `src/lib/data/mappers.ts`.
 */

export type DbProfileRole = "shop_owner" | "worker";
export type DbShiftStatus = "open" | "matched" | "completed" | "cancelled";
export type DbApplicationStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          phone: string | null;
          role: DbProfileRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          phone?: string | null;
          role: DbProfileRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          phone?: string | null;
          role?: DbProfileRole;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      shops: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          address: string;
          area: string | null;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          address: string;
          area?: string | null;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          address?: string;
          area?: string | null;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workers: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          phone: string | null;
          area: string | null;
          experience: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          phone?: string | null;
          area?: string | null;
          experience?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          phone?: string | null;
          area?: string | null;
          experience?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      shifts: {
        Row: {
          id: string;
          shop_id: string;
          title: string;
          date: string;
          start_time: string;
          end_time: string;
          hourly_wage: number;
          required_workers: number;
          applicant_count: number;
          status: DbShiftStatus;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          title: string;
          date: string;
          start_time: string;
          end_time: string;
          hourly_wage: number;
          required_workers: number;
          applicant_count?: number;
          status?: DbShiftStatus;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          title?: string;
          date?: string;
          start_time?: string;
          end_time?: string;
          hourly_wage?: number;
          required_workers?: number;
          applicant_count?: number;
          status?: DbShiftStatus;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      applications: {
        Row: {
          id: string;
          shift_id: string;
          worker_id: string;
          status: DbApplicationStatus;
          message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shift_id: string;
          worker_id: string;
          status?: DbApplicationStatus;
          message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shift_id?: string;
          worker_id?: string;
          status?: DbApplicationStatus;
          message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      /** Atomic accept (migration 0003). Returns a stable JSON result payload. */
      accept_application: {
        Args: { p_application_id: string };
        Returns: {
          application_id: string;
          shift_id: string;
          application_status: string;
          shift_status: string;
          accepted_count: number;
          required_workers: number;
        };
      };
      /** Atomic apply (migration 0004). Worker derived from auth.uid(). */
      apply_to_shift: {
        Args: { p_shift_id: string };
        Returns: {
          application_id: string;
          shift_id: string;
          worker_id: string;
          status: string;
          created_at: string;
        };
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
