import type { BubanGoRepository } from "@/lib/data/bubango-repository";
import { localStorageRepository } from "@/lib/data/local-storage-repository";

/**
 * Single switch point for the active data backend.
 * To migrate to Supabase, replace the return value here.
 */
export function getRepository(): BubanGoRepository {
  return localStorageRepository;
}
