import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";
import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * Browser-side Supabase client (singleton).
 *
 * Uses `@supabase/ssr` so the auth session is stored in cookies and shared
 * with Server Components / route handlers. Reads public env vars only — never
 * the service_role key.
 */

type BrowserClient = ReturnType<typeof createBrowserClient<Database>>;

let cachedClient: BrowserClient | undefined;

export function getBrowserSupabaseClient(): BrowserClient {
  if (!cachedClient) {
    const { url, anonKey } = getSupabaseEnv();
    cachedClient = createBrowserClient<Database>(url, anonKey);
  }
  return cachedClient;
}
