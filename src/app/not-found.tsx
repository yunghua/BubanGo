import { MobileShell } from "@/components/layout/MobileShell";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export default function NotFound() {
  return (
    <MobileShell>
      <div className="flex min-h-[70dvh] flex-col items-center justify-center text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon name="search" size={30} />
        </div>
        <h1 className="text-xl font-bold text-text">找不到頁面</h1>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-text-muted">
          這個頁面不存在或已被移除，回首頁再試一次吧。
        </p>
        <LinkButton href="/" className="mt-6">
          回到首頁
        </LinkButton>
      </div>
    </MobileShell>
  );
}
