import { MobileShell } from "@/components/layout/MobileShell";
import { LinkButton } from "@/components/ui/Button";

export default function HomePage() {
  return (
    <MobileShell>
      <div className="flex min-h-[80dvh] flex-col items-center justify-center text-center">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-primary">BubanGo</h1>
          <p className="mt-2 text-lg text-text-muted">補班，就現在</p>
        </div>

        <p className="mb-8 max-w-xs text-sm leading-relaxed text-text-muted">
          飲料店、小吃店快速發布 2–3 小時缺班，
          打工者輕鬆找到附近臨時工作機會。
        </p>

        <div className="flex w-full flex-col gap-3">
          <LinkButton href="/auth/register?role=shop" size="lg" fullWidth>
            我是店家，要發布缺班
          </LinkButton>
          <LinkButton
            href="/auth/register?role=worker"
            variant="outline"
            size="lg"
            fullWidth
          >
            我是打工者，要找缺班
          </LinkButton>
          <LinkButton href="/auth/login" variant="ghost" fullWidth>
            已有帳號？登入
          </LinkButton>
        </div>
      </div>
    </MobileShell>
  );
}
