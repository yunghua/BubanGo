import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { cn } from "@/lib/utils";

interface RegisterPageProps {
  searchParams: Promise<{ role?: string }>;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const { role } = await searchParams;
  const isShop = role === "shop";

  return (
    <MobileShell>
      <PageHeader
        title="建立帳號"
        subtitle={isShop ? "開始發布缺班，快速補人" : "找到附近的臨時打工機會"}
        backHref="/"
      />

      <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
        <Link
          href="/auth/register?role=shop"
          className={cn(
            "rounded-lg py-2.5 text-center text-sm font-semibold transition-colors",
            isShop ? "bg-surface text-primary shadow-sm" : "text-text-muted"
          )}
        >
          我是店家
        </Link>
        <Link
          href="/auth/register?role=worker"
          className={cn(
            "rounded-lg py-2.5 text-center text-sm font-semibold transition-colors",
            !isShop ? "bg-surface text-primary shadow-sm" : "text-text-muted"
          )}
        >
          我是打工者
        </Link>
      </div>

      <RegisterForm role={isShop ? "shop" : "worker"} />
    </MobileShell>
  );
}
