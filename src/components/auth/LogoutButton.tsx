"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useBubanGoData } from "@/hooks/useBubanGoData";
import { logout } from "@/lib/auth/auth-service";

interface LogoutButtonProps {
  /** Button text — defaults to 「登出」; pass 「登出 / 切換帳號」 where switching is the point. */
  label?: string;
  /** Optional helper copy rendered under the button. */
  hint?: string;
}

export function LogoutButton({ label = "登出", hint }: LogoutButtonProps) {
  const router = useRouter();
  const { refresh } = useBubanGoData();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);
    try {
      await logout();
    } catch {
      // Even if sign-out fails server-side, clear local state and continue.
    }
    await refresh();
    // Land on the login page so the user can immediately switch accounts.
    router.push("/auth/login");
  }

  return (
    <div>
      <Button variant="outline" fullWidth disabled={busy} onClick={handleLogout}>
        {busy ? (
          "登出中…"
        ) : (
          <>
            <Icon name="logOut" size={18} />
            {label}
          </>
        )}
      </Button>
      {hint && <p className="mt-2 text-center text-xs text-text-muted">{hint}</p>}
    </div>
  );
}
