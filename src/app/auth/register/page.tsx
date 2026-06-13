import { MobileShell } from "@/components/layout/MobileShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Input } from "@/components/ui/Input";
import { Button, LinkButton } from "@/components/ui/Button";

interface RegisterPageProps {
  searchParams: Promise<{ role?: string }>;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const { role } = await searchParams;
  const isShop = role === "shop";

  return (
    <MobileShell>
      <PageHeader
        title="註冊"
        subtitle={isShop ? "建立店家帳號" : "建立打工者帳號"}
        backHref="/"
      />

      <form
        className="flex flex-col gap-4"
        action={isShop ? "/store" : "/worker/profile"}
      >
        <Input label="Email" type="email" placeholder="your@email.com" required />
        <Input label="密碼" type="password" placeholder="至少 8 個字元" required />
        <Input
          label="確認密碼"
          type="password"
          placeholder="再次輸入密碼"
          required
        />

        {isShop ? (
          <>
            <Input label="店家名稱" placeholder="例：好飲茶飲店" required />
            <Input label="店家電話" type="tel" placeholder="0912-345-678" required />
          </>
        ) : (
          <>
            <Input label="姓名" placeholder="你的姓名" required />
            <Input label="手機" type="tel" placeholder="0987-654-321" required />
          </>
        )}

        <Button type="submit" fullWidth size="lg" className="mt-2">
          建立帳號
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-text-muted">
        已有帳號？{" "}
        <LinkButton href="/auth/login" variant="ghost" size="sm" className="inline p-0">
          登入
        </LinkButton>
      </p>
    </MobileShell>
  );
}
