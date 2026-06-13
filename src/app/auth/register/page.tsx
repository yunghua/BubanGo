import { MobileShell } from "@/components/layout/MobileShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { RegisterForm } from "@/components/auth/RegisterForm";

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

      <RegisterForm role={isShop ? "shop" : "worker"} />
    </MobileShell>
  );
}
