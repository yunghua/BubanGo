import { Suspense } from "react";
import { MobileShell } from "@/components/layout/MobileShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageLoading } from "@/components/ui/Spinner";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <MobileShell>
      <PageHeader title="登入" subtitle="使用 Email 登入你的帳號" backHref="/" />
      <Suspense fallback={<PageLoading />}>
        <LoginForm />
      </Suspense>
    </MobileShell>
  );
}
