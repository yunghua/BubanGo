import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase/server";

/**
 * POST /api/line/unlink
 *
 * Removes the signed-in user's LINE binding. RLS (line_accounts_delete_own)
 * already restricts deletes to the caller's own row; the explicit user_id filter
 * is defense in depth. No service_role key.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await getServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { error } = await supabase
    .from("line_accounts")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: "unlink_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
