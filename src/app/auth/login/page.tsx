import { MobileShell } from "@/components/layout/MobileShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Input } from "@/components/ui/Input";
import { Button, LinkButton } from "@/components/ui/Button";

export default function LoginPage() {
  return (
    <MobileShell>
      <PageHeader title="登入" subtitle="使用 Email 登入你的帳號" backHref="/" />

      <form className="flex flex-col gap-4" action="/shifts">
        <Input label="Email" type="email" placeholder="your@email.com" required />
        <Input label="密碼" type="password" placeholder="••••••••" required />

        <Button type="submit" fullWidth size="lg" className="mt-2">
          登入
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-text-muted">
        還沒有帳號？{" "}
        <LinkButton href="/auth/register" variant="ghost" size="sm" className="inline p-0">
          立即註冊
        </LinkButton>
      </p>
    </MobileShell>
  );
}
