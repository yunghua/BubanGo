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
 * - /onboarding (base) is the role chooser for first-time LINE users (no role
 *   yet); /onboarding/{shop,worker} require auth and are role-gated, but the
 *   matching role is allowed in even with a missing shop/worker row (fallback).
 * - Role comes from `user.user_metadata.role`, so no extra DB round-trip and no
 *   RLS dependency. LINE users have NO role until onboarding sets it (and mirrors
 *   it into metadata), so an authenticated user without a role is sent to
 *   /onboarding rather than assumed to be any particular role.
 * - Dev bypass: with NEXT_PUBLIC_DATA_BACKEND=local there is no Supabase session,
 *   so middleware does nothing and the localStorage flow works unblocked.
 *
 * Uses the @supabase/ssr request/response cookie bridge and preserves any
 * refreshed-session cookies across redirects.
 */

const PROTECTED_PREFIXES = ["/store", "/worker"] as const;
const AUTH_ROUTES = ["/auth/login", "/auth/register"] as const;
const ONBOARDING_ROUTES = ["/onboarding/shop", "/onboarding/worker"] as const;

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isAuthRoute(pathname: string): boolean {
  return (AUTH_ROUTES as readonly string[]).includes(pathname);
}

function isOnboardingRoute(pathname: string): boolean {
  return (ONBOARDING_ROUTES as readonly string[]).includes(pathname);
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
    // Any signed-in user leaves the auth pages: to their role home, or to the
    // onboarding chooser if they haven't picked a role yet (first-time LINE).
    if (user) {
      const url = request.nextUrl.clone();
      url.pathname = roleHomePath(role) ?? "/onboarding";
      url.search = "";
      return redirectPreservingCookies(url, supabaseResponse);
    }
    return supabaseResponse;
  }

  // Base onboarding = the role chooser for first-time users without a role yet
  // (primarily LINE Login users). Require auth; bounce already-roled users home.
  if (pathname === "/onboarding") {
    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/auth/login";
      loginUrl.search = "";
      loginUrl.searchParams.set("redirect", `${pathname}${search}`);
      return redirectPreservingCookies(loginUrl, supabaseResponse);
    }
    const home = roleHomePath(role);
    if (home) {
      const url = request.nextUrl.clone();
      url.pathname = home;
      url.search = "";
      return redirectPreservingCookies(url, supabaseResponse);
    }
    return supabaseResponse;
  }

  // Onboarding pages: require auth and gate by role, but ALLOW the matching role
  // even when their shop/worker row is missing — that's the whole point of the
  // fallback. The page itself redirects away once the row exists.
  if (isOnboardingRoute(pathname)) {
    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/auth/login";
      loginUrl.search = "";
      loginUrl.searchParams.set("redirect", `${pathname}${search}`);
      return redirectPreservingCookies(loginUrl, supabaseResponse);
    }
    const wrongRole =
      (pathname === "/onboarding/shop" && role === "worker") ||
      (pathname === "/onboarding/worker" && role === "shop_owner");
    const home = roleHomePath(role);
    if (wrongRole && home) {
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

  // Authenticated but no role yet (first-time LINE user) → finish onboarding
  // before entering a role area. Email/password users always carry a role, so
  // this only affects users who signed in before choosing 身分.
  const home = roleHomePath(role);
  if (!home) {
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding";
    url.search = "";
    return redirectPreservingCookies(url, supabaseResponse);
  }

  // Role-based protection: wrong role → correct home.
  const wrongRole =
    (isUnder(pathname, "/store") && role === "worker") ||
    (isUnder(pathname, "/worker") && role === "shop_owner");

  if (wrongRole) {
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
    "/onboarding",
    "/onboarding/shop",
    "/onboarding/worker",
  ],
};
