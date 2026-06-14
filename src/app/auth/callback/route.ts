import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase/server";

/**
 * OAuth callback for LINE Login (Supabase Custom OAuth provider `custom:line`).
 *
 * Supabase redirects here with `?code=...` after the user authorizes on LINE.
 * We exchange the code for a session (cookies written via the SSR server
 * client), then route by the user's profile/role:
 *   - no profile / no role  → /onboarding (first-time LINE user picks 身分)
 *   - shop_owner            → /store
 *   - worker                → /shifts
 * A safe same-site `?next=` is honored only for already-onboarded users.
 *
 * This route is never matched by middleware (matcher excludes /auth/callback
 * and all /api), so there is no redirect interference here.
 */

export const dynamic = "force-dynamic";

function safeNext(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  const loginError = (reason: string) =>
    NextResponse.redirect(`${origin}/auth/login?error=${reason}`);

  if (!code) return loginError("line");

  const supabase = await getServerSupabaseClient();

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) return loginError("line");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return loginError("line");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  let dest = "/onboarding";
  if (profile?.role === "shop_owner") dest = "/store";
  else if (profile?.role === "worker") dest = "/shifts";

  // Honor an explicit destination only once the user is fully onboarded.
  if (profile?.role && next) dest = next;

  return NextResponse.redirect(`${origin}${dest}`);
}
