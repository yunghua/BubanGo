import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase/server";
import { sendLineTextPush } from "@/lib/line/line-messaging";
import { formatDate } from "@/lib/utils";

/**
 * POST /api/applications/[applicationId]/accept
 *
 * Server-side accept flow. Wraps the existing row-locked `accept_application`
 * RPC so that, after a successful accept, the server can:
 *   1. auto-decline the remaining pending applicants when the shift just filled
 *      (moved here from the browser repository — more robust than a best-effort
 *      client call that a navigation could interrupt); and
 *   2. send a LINE push to the accepted worker if they have a linked LINE
 *      account. The Messaging API token (LINE_CHANNEL_ACCESS_TOKEN) is read only
 *      here, server-side, and is never exposed to the browser.
 *
 * The accept's authorization / capacity / concurrency guarantees are UNCHANGED:
 * the RPC runs under the owner's own cookie session, exactly as the old direct
 * browser call did. The auto-decline and the push are best-effort and never
 * change whether the accept itself succeeded.
 *
 * The response never includes the worker's line_user_id — only a coarse,
 * non-sensitive push status.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ServerClient = Awaited<ReturnType<typeof getServerSupabaseClient>>;

type PushStatus =
  | "sent"
  | "skipped_no_line"
  | "skipped_unconfigured"
  | "failed";

function fail(code: string, status: number) {
  return NextResponse.json({ error: code }, { status });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  const { applicationId } = await params;
  const supabase = await getServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("not_authenticated", 401);

  // 1) Accept atomically. Ownership / open / capacity are all enforced inside the
  //    RPC (SECURITY DEFINER, row-locked). On error, forward the RPC's code so the
  //    repository maps it to the same UI text users already see.
  const { data: accept, error: acceptError } = await supabase.rpc(
    "accept_application",
    { p_application_id: applicationId }
  );

  if (acceptError) {
    return fail(acceptError.message, 400);
  }

  const shiftId = accept?.shift_id ?? null;
  const shiftStatus = accept?.shift_status ?? null;

  // 2) If this accept filled the shift, decline the still-pending applicants so
  //    they don't sit in 審核中 forever. Best-effort; never blocks the accept.
  if (shiftStatus === "matched" && shiftId) {
    await declineRemainingPending(supabase, shiftId, applicationId);
  }

  // 3) Best-effort LINE push to the accepted worker. Never blocks the accept.
  const push = await notifyAcceptedWorker(supabase, applicationId, shiftId);

  return NextResponse.json({ ok: true, shiftStatus, push });
}

/**
 * Reject every still-pending application on a now-matched shift (except the one
 * just accepted) via the existing reject_application RPC. Runs them in parallel
 * and logs how many failed; it never throws, so it cannot undo the committed
 * accept. (Ported from SupabaseRepository.declineRemainingPending.)
 */
async function declineRemainingPending(
  supabase: ServerClient,
  shiftId: string,
  acceptedApplicationId: string
): Promise<void> {
  const { data: pending, error } = await supabase
    .from("applications")
    .select("id")
    .eq("shift_id", shiftId)
    .eq("status", "pending");

  if (error || !pending) return;

  const toDecline = pending.filter((a) => a.id !== acceptedApplicationId);
  if (toDecline.length === 0) return;

  const results = await Promise.allSettled(
    toDecline.map((a) =>
      supabase
        .rpc("reject_application", { p_application_id: a.id })
        .then(({ error: rejectError }) => {
          if (rejectError) throw new Error(rejectError.message);
        })
    )
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    console.error(
      `[accept route] failed to auto-decline ${failed} pending application(s)`
    );
  }
}

/**
 * Resolve the accepted worker's LINE userId (via the SECURITY DEFINER
 * get_line_push_target RPC — the owner's session cannot read line_accounts
 * directly under RLS) and send a plain-text push. Returns a coarse status; the
 * line_user_id itself is never returned to the caller or logged.
 */
async function notifyAcceptedWorker(
  supabase: ServerClient,
  applicationId: string,
  shiftId: string | null
): Promise<PushStatus> {
  try {
    const { data: lineUserId, error } = await supabase.rpc(
      "get_line_push_target",
      { p_application_id: applicationId }
    );

    if (error) {
      console.error("[accept route] get_line_push_target failed");
      return "failed";
    }
    if (!lineUserId) return "skipped_no_line";

    const text = shiftId ? await buildAcceptMessage(supabase, shiftId) : null;
    if (!text) return "failed";

    const { status } = await sendLineTextPush(lineUserId, text);
    return status;
  } catch {
    console.error("[accept route] notify accepted worker error");
    return "failed";
  }
}

/** Build the plain-text accept notice from owner-readable shift / shop data. */
async function buildAcceptMessage(
  supabase: ServerClient,
  shiftId: string
): Promise<string | null> {
  const { data: shift } = await supabase
    .from("shifts")
    .select("shop_id, title, date, start_time, end_time")
    .eq("id", shiftId)
    .maybeSingle();
  if (!shift) return null;

  const { data: shop } = await supabase
    .from("shops")
    .select("name")
    .eq("id", shift.shop_id)
    .maybeSingle();

  const shopName = shop?.name ?? "";
  // MVP: shifts.title carries the location string (see mappers.ts / schema).
  const shiftTitle = shift.title;
  const date = formatDate(shift.date);
  const start = shift.start_time.slice(0, 5); // "HH:MM:SS" → "HH:MM"
  const end = shift.end_time.slice(0, 5);

  return [
    "你已錄取補班！",
    "",
    `店家：${shopName}`,
    `缺班：${shiftTitle}`,
    `時間：${date} ${start}–${end}`,
    "",
    "請準時到班，如有問題請盡快聯絡店家。",
  ].join("\n");
}
