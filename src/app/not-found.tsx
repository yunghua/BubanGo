import { MobileShell } from "@/components/layout/MobileShell";
import { LinkButton } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <MobileShell>
      <div className="flex min-h-[60dvh] flex-col items-center justify-center text-center">
        <p className="text-6xl">🤔</p>
        <h1 className="mt-4 text-xl font-bold">找不到頁面</h1>
        <p className="mt-2 text-sm text-text-muted">這個頁面不存在或已被移除</p>
        <LinkButton href="/" className="mt-6">
          回到首頁
        </LinkButton>
      </div>
    </MobileShell>
  );
}
