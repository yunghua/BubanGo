import type { BubanGoRepository } from "@/lib/data/bubango-repository";
import { localStorageRepository } from "@/lib/data/local-storage-repository";
import { supabaseRepository } from "@/lib/data/supabase-repository";

/**
 * Single switch point for the active data backend.
 *
 * Controlled by NEXT_PUBLIC_DATA_BACKEND:
 *   "supabase" (default) → Supabase (auth + Postgres + RLS)
 *   "local"              → localStorage MVP repository (dev fallback, no backend)
 */
type Backend = "supabase" | "local";

function resolveBackend(): Backend {
  return process.env.NEXT_PUBLIC_DATA_BACKEND?.toLowerCase() === "local"
    ? "local"
    : "supabase";
}

export function getRepository(): BubanGoRepository {
  return resolveBackend() === "local" ? localStorageRepository : supabaseRepository;
}
