import { Suspense } from "react";
import { MobileShell } from "@/components/layout/MobileShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <MobileShell>
      <PageHeader title="登入" subtitle="使用 Email 登入你的帳號" backHref="/" />
      <Suspense fallback={<p className="text-sm text-text-muted">載入中...</p>}>
        <LoginForm />
      </Suspense>
    </MobileShell>
  );
}
