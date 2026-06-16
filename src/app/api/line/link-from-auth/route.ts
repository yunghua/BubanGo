import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase/server";

/**
 * POST /api/line/link-from-auth
 *
 * Binds the signed-in BubanGo user to their LINE account using the LINE userId
 * already present in their Supabase auth identity (Custom OAuth provider
 * `custom:line`) — no LIFF SDK / no ID token from the browser.
 *
 * Why: in the LINE in-app browser, liff.init() is unreliable after the Supabase
 * OAuth round-trip ("INIT_FAILED: Unable to load client features"). But a LINE
 * user is already authenticated, and Supabase verified their LINE OIDC token
 * during the code exchange — so the trusted LINE `sub` lives in their identity.
 *
 * Trust model: the LINE userId is taken from the user's own Supabase session
 * (auth.getUser revalidates the JWT). We read it from `identity_data` / the
 * identity id (managed by Supabase Auth, not user-writable) in preference to
 * `user_metadata` (which the user can mutate). Writes go through the RLS-scoped
 * client (no service_role); line_accounts policies allow only auth.uid() ==
 * user_id, and the unique index on line_user_id prevents claiming a LINE account
 * already bound elsewhere.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(code: string, status: number) {
  return NextResponse.json({ error: code }, { status });
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

export async function POST() {
  const supabase = await getServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("not_authenticated", 401);

  // Locate the LINE identity (Custom OAuth provider id is `custom:line`; fall
  // back to any provider whose name mentions "line").
  const identities = user.identities ?? [];
  const lineIdentity =
    identities.find((i) => i.provider === "custom:line") ??
    identities.find((i) => i.provider?.toLowerCase().includes("line"));

  const idData = (lineIdentity?.identity_data ?? {}) as Record<string, unknown>;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;

  // LINE userId = OIDC `sub`. Prefer identity_data / identity.id (managed by
  // Supabase Auth) over user_metadata (user-mutable) for this trusted value.
  const lineUserId =
    str(idData.sub) ??
    str(idData.provider_id) ??
    str(lineIdentity?.id) ??
    str(meta.sub) ??
    str(meta.provider_id);

  if (!lineUserId) {
    // Temporary diagnostic: log only the available KEY names, never the values.
    console.warn("[link-from-auth] LINE id not found", {
      providers: identities.map((i) => i.provider),
      identityDataKeys: Object.keys(idData),
      metadataKeys: Object.keys(meta),
    });
    return fail("line_identity_missing", 422);
  }

  // Display name / picture are cosmetic, so metadata fallbacks are fine here.
  const displayName =
    str(idData.name) ??
    str(meta.name) ??
    str(meta.display_name) ??
    str(meta.full_name);
  const pictureUrl =
    str(idData.picture) ?? str(meta.picture) ?? str(meta.avatar_url);

  // Upsert on user_id (one LINE account per BubanGo user). If this LINE userId
  // is already bound to a DIFFERENT user, the line_user_id unique index raises
  // 23505, surfaced as already-linked (the other row is invisible under RLS).
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
