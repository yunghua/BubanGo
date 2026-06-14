import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase/server";

/**
 * POST /api/line/link
 *
 * Binds the signed-in BubanGo user to a LINE account.
 *
 * Security model:
 * - Requires a valid Supabase session (auth.getUser revalidates the JWT).
 * - The client sends a LINE *ID token* only — never a raw LINE userId. We verify
 *   that token with LINE's own endpoint (signature + expiry + audience) and read
 *   the LINE userId from the verified payload. The browser is never trusted for
 *   identity.
 * - Writes go through the user's RLS-scoped client (no service_role key): the
 *   line_accounts policies only allow auth.uid() == user_id.
 *
 * Verifying via https://api.line.me/oauth2/v2.1/verify needs the Channel ID
 * (audience) but NOT the Channel secret.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LINE_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

function fail(code: string, status: number) {
  return NextResponse.json({ error: code }, { status });
}

interface LineIdTokenPayload {
  sub?: string; // LINE userId
  aud?: string; // channel id
  name?: string;
  picture?: string;
}

export async function POST(request: Request) {
  const supabase = await getServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("not_authenticated", 401);

  let idToken: string | undefined;
  try {
    const body = (await request.json()) as { idToken?: unknown };
    idToken = typeof body?.idToken === "string" ? body.idToken : undefined;
  } catch {
    idToken = undefined;
  }
  if (!idToken) return fail("missing_id_token", 400);

  const channelId = process.env.LINE_CHANNEL_ID;
  if (!channelId) return fail("line_config_missing", 500);

  // Verify the ID token with LINE — checks signature, expiry and audience,
  // entirely server-side. No Channel secret required.
  let payload: LineIdTokenPayload;
  try {
    const verifyRes = await fetch(LINE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
    });
    if (!verifyRes.ok) return fail("invalid_line_token", 400);
    payload = (await verifyRes.json()) as LineIdTokenPayload;
  } catch {
    return fail("invalid_line_token", 400);
  }

  // Defense in depth: the verify endpoint already enforces aud == client_id,
  // but re-check and require a subject before trusting the payload.
  if (!payload?.sub || payload.aud !== channelId) {
    return fail("invalid_line_token", 400);
  }

  const lineUserId = payload.sub;
  const displayName = payload.name ?? null;
  const pictureUrl = payload.picture ?? null;

  // Upsert on user_id (one LINE account per BubanGo user). If this LINE userId
  // is already bound to a DIFFERENT user, the line_user_id unique index raises
  // Postgres 23505, which we surface as already-linked (the other user's row is
  // invisible to us under RLS, so the constraint is how we detect it).
  const { data, error } = await supabase
    .from("line_accounts")
    .upsert(
      {
        user_id: user.id,
        line_user_id: lineUserId,
        display_name: displayName,
        picture_url: pictureUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select("display_name, picture_url, linked_at")
    .single();

  if (error) {
    if (error.code === "23505") return fail("line_account_already_linked", 409);
    return fail("link_failed", 500);
  }

  return NextResponse.json({
    ok: true,
    account: {
      displayName: data.display_name,
      pictureUrl: data.picture_url,
      linkedAt: data.linked_at,
    },
  });
}
