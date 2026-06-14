"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button, LinkButton } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { LineLoginButton } from "@/components/auth/LineLoginButton";
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
  const lineError = searchParams.get("error") === "line";

  const [showEmail, setShowEmail] = useState(false);
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
        // Profile/role missing (e.g. an account that never finished onboarding).
        router.push("/onboarding");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "登入失敗，請稍後再試");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {redirectTarget && <Alert variant="info">請先登入後繼續</Alert>}
      {lineError && (
        <Alert variant="error">LINE 登入未完成，請再試一次或改用 Email 登入。</Alert>
      )}

      <LineLoginButton next={redirectTarget ?? undefined} />
      <p className="text-center text-xs text-text-muted">
        建議使用 LINE，免記密碼、最快開始
      </p>

      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-text-muted">或</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {!showEmail ? (
        <Button variant="outline" fullWidth onClick={() => setShowEmail(true)}>
          使用 Email 登入
        </Button>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
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

          <Button type="submit" fullWidth size="lg" disabled={submitting}>
            {submitting ? "登入中…" : "登入"}
          </Button>
        </form>
      )}

      <p className="mt-1 text-center text-sm text-text-muted">
        還沒有帳號？{" "}
        <LinkButton
          href="/auth/register"
          variant="ghost"
          size="sm"
          className="inline p-0 font-semibold text-primary"
        >
          使用 Email 註冊
        </LinkButton>
      </p>
    </div>
  );
}
