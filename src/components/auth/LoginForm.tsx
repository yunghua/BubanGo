"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button, LinkButton } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useBubanGoData } from "@/hooks/useBubanGoData";
import { login } from "@/lib/auth/auth-service";

/** Only allow same-site absolute paths as a post-login redirect target. */
function safeRedirect(path: string | null): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useBubanGoData();

  const redirectTarget = safeRedirect(searchParams.get("redirect"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const { role, needsOnboarding } = await login(email.trim(), password);
      await refresh();

      if (role === "shop") {
        // Missing shop row (e.g. trigger didn't run) → finish setup first.
        router.push(needsOnboarding ? "/onboarding/shop" : (redirectTarget ?? "/store"));
      } else if (role === "worker") {
        router.push(needsOnboarding ? "/onboarding/worker" : (redirectTarget ?? "/shifts"));
      } else {
        setError("找不到帳號角色資料，請重新註冊或聯絡客服。");
        setSubmitting(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "登入失敗，請稍後再試");
      setSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      {redirectTarget && <Alert variant="info">請先登入後繼續</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      <Input
        label="Email"
        type="email"
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Input
        label="密碼"
        type="password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      <Button type="submit" fullWidth size="lg" className="mt-2" disabled={submitting}>
        {submitting ? "登入中…" : "登入"}
      </Button>

      <p className="mt-2 text-center text-sm text-text-muted">
        還沒有帳號？{" "}
        <LinkButton
          href="/auth/register"
          variant="ghost"
          size="sm"
          className="inline p-0 font-semibold text-primary"
        >
          立即註冊
        </LinkButton>
      </p>
    </form>
  );
}
