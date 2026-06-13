"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useBubanGoData } from "@/hooks/useBubanGoData";
import { logout } from "@/lib/auth/auth-service";

export function LogoutButton() {
  const router = useRouter();
  const { refresh } = useBubanGoData();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);
    try {
      await logout();
    } catch {
      // Even if sign-out fails server-side, clear local state and go home.
    }
    await refresh();
    router.push("/");
  }

  return (
    <Button variant="outline" fullWidth disabled={busy} onClick={handleLogout}>
      {busy ? (
        "登出中…"
      ) : (
        <>
          <Icon name="logOut" size={18} />
          登出
        </>
      )}
    </Button>
  );
}
