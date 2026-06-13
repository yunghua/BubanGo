import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/types";
import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * Server-side Supabase client for Server Components, Route Handlers and
 * Server Actions. Binds Supabase auth to the Next.js cookie store so the
 * session set in the browser is readable on the server.
 *
 * Reads public env vars only — the service_role key is never used here.
 *
 * Note: when called from a Server Component, cookie writes throw and are
 * ignored (Next.js only allows cookie mutations in actions / route handlers).
 * Pair with middleware if you need automatic token refresh on the server.
 */
export async function getServerSupabaseClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component — cookie mutations are not allowed
          // here. Safe to ignore when a middleware refreshes the session.
        }
      },
    },
  });
}
