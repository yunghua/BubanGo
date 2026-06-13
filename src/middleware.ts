import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * Auth route protection + auth-page redirect for signed-in users.
 *
 * - Unauthenticated users hitting a protected area are sent to
 *   /auth/login?redirect=<original path> (the login form sends them back).
 * - Role mismatch is bounced to the correct home (worker→/shifts, owner→/store).
 * - Signed-in users hitting /auth/login or /auth/register are bounced to their
 *   role home (a logged-in user has no reason to see those pages).
 * - Role comes from `user.user_metadata.role` (set at sign-up), so no extra DB
 *   round-trip and no RLS dependency.
 * - Dev bypass: with NEXT_PUBLIC_DATA_BACKEND=local there is no Supabase session,
 *   so middleware does nothing and the localStorage flow works unblocked.
 *
 * Uses the @supabase/ssr request/response cookie bridge and preserves any
 * refreshed-session cookies across redirects.
 */

const PROTECTED_PREFIXES = ["/store", "/worker"] as const;
const AUTH_ROUTES = ["/auth/login", "/auth/register"] as const;

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isAuthRoute(pathname: string): boolean {
  return (AUTH_ROUTES as readonly string[]).includes(pathname);
}

/** Role home. null for unknown roles → callers fall through (no redirect loop). */
function roleHomePath(role: string | null): string | null {
  if (role === "shop_owner") return "/store";
  if (role === "worker") return "/shifts";
  return null;
}

function redirectPreservingCookies(url: URL, from: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

export async function middleware(request: NextRequest) {
  // Dev fallback backend has no Supabase auth — never block it.
  if (process.env.NEXT_PUBLIC_DATA_BACKEND === "local") {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  let env: { url: string; anonKey: string };
  try {
    env = getSupabaseEnv();
  } catch {
    // Supabase env not configured — fail open rather than break the whole app.
    return supabaseResponse;
  }

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: getUser() revalidates the token and may refresh the session
  // cookies (written via setAll above). Run it before any redirect.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const role = user
    ? ((user.user_metadata?.role as string | undefined) ?? null)
    : null;

  // Auth pages: a signed-in user is bounced to their role home. Unauthenticated
  // (user = null) and unknown-role (home = null) users fall through and see the
  // page — this is what prevents a redirect loop with the protection below.
  if (isAuthRoute(pathname)) {
    const home = user ? roleHomePath(role) : null;
    if (home) {
      const url = request.nextUrl.clone();
      url.pathname = home;
      url.search = "";
      return redirectPreservingCookies(url, supabaseResponse);
    }
    return supabaseResponse;
  }

  if (!isProtected(pathname)) {
    return supabaseResponse;
  }

  // Not signed in → login, remembering where they were headed.
  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("redirect", `${pathname}${search}`);
    return redirectPreservingCookies(loginUrl, supabaseResponse);
  }

  // Role-based protection. Unknown role (home = null) falls through and the
  // page's own empty state handles it.
  const home = roleHomePath(role);
  const wrongRole =
    (isUnder(pathname, "/store") && role === "worker") ||
    (isUnder(pathname, "/worker") && role === "shop_owner");

  if (wrongRole && home) {
    const url = request.nextUrl.clone();
    url.pathname = home;
    url.search = "";
    return redirectPreservingCookies(url, supabaseResponse);
  }

  return supabaseResponse;
}

function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export const config = {
  matcher: [
    "/store",
    "/store/:path*",
    "/worker",
    "/worker/:path*",
    "/auth/login",
    "/auth/register",
  ],
};
