/**
 * Server-only LINE Messaging API push helper.
 *
 * Sends a single plain-text push to one LINE userId using the Messaging API
 * channel access token. It is imported ONLY from server code (the accept route);
 * the token lives in `LINE_CHANNEL_ACCESS_TOKEN`, which is intentionally NOT
 * prefixed with `NEXT_PUBLIC_`, so Next.js never inlines it into the browser
 * bundle. The token and the recipient's line_user_id are NEVER logged.
 *
 * This is the Messaging API channel access token — NOT the LINE Login channel
 * secret. See docs/LINE_ACCOUNT_BINDING.md.
 */

const LINE_PUSH_ENDPOINT = "https://api.line.me/v2/bot/message/push";

export type LinePushStatus = "sent" | "skipped_unconfigured" | "failed";

export interface LinePushResult {
  status: LinePushStatus;
}

/**
 * Push a plain-text message to one LINE userId.
 *
 *  - "skipped_unconfigured": LINE_CHANNEL_ACCESS_TOKEN is not set (push disabled).
 *  - "sent":   LINE returned a 2xx.
 *  - "failed": a non-2xx (e.g. recipient hasn't added the OA → 403) or a network
 *              error. Logged with the HTTP status only — never the token or the
 *              recipient userId.
 *
 * Never throws: callers treat the push as best-effort and must not let it affect
 * whether the accept itself succeeded.
 */
export async function sendLineTextPush(
  lineUserId: string,
  text: string
): Promise<LinePushResult> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    return { status: "skipped_unconfigured" };
  }

  try {
    const res = await fetch(LINE_PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: "text", text }],
      }),
    });

    if (!res.ok) {
      // Status only — no token, no recipient userId, no response body.
      console.error(`[line-messaging] push failed: HTTP ${res.status}`);
      return { status: "failed" };
    }

    return { status: "sent" };
  } catch {
    // Network / transport error. Nothing sensitive in the log.
    console.error("[line-messaging] push request error");
    return { status: "failed" };
  }
}
