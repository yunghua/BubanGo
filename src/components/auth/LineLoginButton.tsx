"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import { signInWithLine } from "@/lib/auth/auth-service";

interface LineLoginButtonProps {
  /** Safe same-site path to return an already-onboarded user to after login. */
  next?: string;
  label?: string;
  className?: string;
}

/**
 * Primary LINE Login CTA. Uses the LINE brand green and kicks off the Supabase
 * Custom OAuth flow; Supabase then redirects the browser to LINE.
 */
export function LineLoginButton({
  next,
  label = "使用 LINE 登入",
  className,
}: LineLoginButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setError("");
    setBusy(true);
    try {
      await signInWithLine(next);
      // On success Supabase redirects the browser; keep `busy` until it does.
    } catch (e) {
      setError(e instanceof Error ? e.message : "LINE 登入失敗，請稍後再試");
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={cn(
          "inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl px-6 text-lg font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-60",
          "bg-[#06C755] shadow-sm shadow-[#06C755]/30 hover:bg-[#05b34c]"
        )}
      >
        <Icon name="chat" size={22} />
        {busy ? "前往 LINE…" : label}
      </button>
      {error && (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-red-600">
          <Icon name="alertCircle" size={15} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
