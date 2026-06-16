"use client";

import { getBrowserSupabaseClient } from "@/lib/supabase/browser";

/**
 * Client-side helpers for the LINE binding card.
 *
 * Reads the caller's own binding directly (RLS-scoped) and performs link/unlink
 * through the server routes, which are the only place a LINE userId is verified
 * and written. Nothing here trusts a client-supplied LINE userId.
 */

export interface LineAccount {
  displayName: string | null;
  pictureUrl: string | null;
  linkedAt: string;
}

export type LineLinkErrorCode =
  | "not_authenticated"
  | "missing_id_token"
  | "invalid_line_token"
  | "line_account_already_linked"
  | "line_config_missing"
  | "line_identity_missing"
  | "liff_unconfigured"
  | "liff_init_error"
  | "not_in_line"
  | "link_failed"
  | "unlink_failed"
  | "network_error";

export class LineLinkError extends Error {
  code: LineLinkErrorCode;
  /** Optional non-secret diagnostic detail (e.g. the raw LIFF init error). */
  detail?: string;
  constructor(code: LineLinkErrorCode, detail?: string) {
    super(code);
    this.code = code;
    this.detail = detail;
    this.name = "LineLinkError";
  }
}

/** The localStorage dev backend has no real Supabase session to bind to. */
export function isLocalBackend(): boolean {
  return process.env.NEXT_PUBLIC_DATA_BACKEND?.toLowerCase() === "local";
}

/** The current user's LINE binding (own row only, via RLS), or null. */
export async function getMyLineAccount(): Promise<LineAccount | null> {
  const supabase = getBrowserSupabaseClient();
  const { data, error } = await supabase
    .from("line_accounts")
    .select("display_name, picture_url, linked_at")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    displayName: data.display_name,
    pictureUrl: data.picture_url,
    linkedAt: data.linked_at,
  };
}

async function postJson(
  url: string,
  body?: unknown
): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new LineLinkError("network_error");
  }

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const code = (json.error as LineLinkErrorCode) ?? "link_failed";
    throw new LineLinkError(code);
  }
  return json;
}

export async function linkLineAccount(idToken: string): Promise<LineAccount> {
  const json = await postJson("/api/line/link", { idToken });
  const acc = (json.account ?? {}) as Partial<LineAccount>;
  return {
    displayName: acc.displayName ?? null,
    pictureUrl: acc.pictureUrl ?? null,
    linkedAt: acc.linkedAt ?? new Date().toISOString(),
  };
}

/**
 * Bind the current user's LINE account using their authenticated Supabase
 * identity (Custom OAuth provider `custom:line`) — no LIFF SDK / ID token.
 * The server derives the LINE userId from the session; throws
 * LineLinkError("line_identity_missing") when the user did not sign in with LINE.
 */
export async function linkLineAccountFromAuth(): Promise<LineAccount> {
  const json = await postJson("/api/line/link-from-auth");
  const acc = (json.account ?? {}) as Partial<LineAccount>;
  return {
    displayName: acc.displayName ?? null,
    pictureUrl: acc.pictureUrl ?? null,
    linkedAt: acc.linkedAt ?? new Date().toISOString(),
  };
}

export async function unlinkLineAccount(): Promise<void> {
  await postJson("/api/line/unlink");
}
