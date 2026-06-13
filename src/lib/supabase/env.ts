/**
 * Reads and normalizes the public Supabase env vars.
 *
 * The Supabase client expects the *project root* URL
 * (https://<ref>.supabase.co). It then appends `/rest/v1`, `/auth/v1`, etc.
 * itself. A common copy-paste mistake is to point the env var at an API
 * sub-path (e.g. `.../rest/v1`), which silently half-works for REST but breaks
 * Auth ("Invalid path specified in request URL"). We defensively strip any such
 * suffix and trailing slashes so the app is robust to that mistake.
 *
 * Only ever reads the public anon key — never the service_role key.
 */
function normalizeSupabaseUrl(raw: string): string {
  return raw
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/(rest|auth|storage|realtime)\/v1$/i, "");
}

export function getSupabaseEnv(): { url: string; anonKey: string } {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!rawUrl || !anonKey) {
    throw new Error(
      "Supabase 環境變數未設定，請在 .env.local 填入 NEXT_PUBLIC_SUPABASE_URL 與 NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return { url: normalizeSupabaseUrl(rawUrl), anonKey: anonKey.trim() };
}
