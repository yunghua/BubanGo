"use client";

/**
 * Thin client-only wrapper around the LIFF SDK.
 *
 * Design goals:
 * - The app must work as a normal web app when NEXT_PUBLIC_LIFF_ID is unset —
 *   every function degrades gracefully (returns `unconfigured` / null), never
 *   throws, and the SDK is only imported dynamically inside the browser.
 * - We obtain the LINE *ID token* (not liff.getProfile().userId) so the server
 *   can verify the user's identity itself. The raw LINE userId is never trusted
 *   from or stored by the client.
 */

// Type of the LIFF SDK default export, derived without a static runtime import.
type LiffClient = (typeof import("@line/liff"))["default"];

export type LiffState =
  | { kind: "unconfigured" } // NEXT_PUBLIC_LIFF_ID missing → plain web app
  | { kind: "ready"; isInClient: boolean; isLoggedIn: boolean }
  | { kind: "error"; message: string };

let liffClient: LiffClient | null = null;
let initPromise: Promise<LiffState> | null = null;

export function isLiffConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_LIFF_ID);
}

/**
 * Best-effort, non-secret description of a LIFF init rejection, for diagnostics.
 * The @line/liff SDK can reject with a LiffError ({ code, message }) or a plain
 * Error; capture whichever string fields are present.
 */
function describeInitError(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { code?: unknown; message?: unknown };
    const parts = [e.code, e.message].filter(
      (v): v is string => typeof v === "string" && v.length > 0
    );
    if (parts.length > 0) return parts.join(": ");
  }
  if (typeof err === "string" && err) return err;
  return "LIFF 初始化失敗";
}

/**
 * Initialize LIFF exactly once. Safe to call anywhere on the client; resolves to
 * `unconfigured` when no LIFF id is set and to `error` (never a throw) on
 * failure so the rest of the UI keeps working.
 */
export function initLiff(): Promise<LiffState> {
  if (typeof window === "undefined") {
    return Promise.resolve({ kind: "unconfigured" });
  }

  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  if (!liffId) {
    return Promise.resolve({ kind: "unconfigured" });
  }

  if (!initPromise) {
    initPromise = (async (): Promise<LiffState> => {
      try {
        const mod = await import("@line/liff");
        const client = mod.default;
        await client.init({ liffId });
        liffClient = client;
        return {
          kind: "ready",
          isInClient: client.isInClient(),
          isLoggedIn: client.isLoggedIn(),
        };
      } catch (err) {
        initPromise = null; // allow a later retry
        return { kind: "error", message: describeInitError(err) };
      }
    })();
  }

  return initPromise;
}

/**
 * The LINE ID token for server-side verification, or null when unavailable
 * (LIFF unconfigured, init failed, or the user is not logged in). We never read
 * or send liff.getProfile().userId — the server derives the userId from the
 * verified token instead.
 */
export async function getLineIdToken(): Promise<string | null> {
  const state = await initLiff();
  if (state.kind !== "ready" || !liffClient) return null;
  if (!liffClient.isLoggedIn()) return null;
  return liffClient.getIDToken();
}
