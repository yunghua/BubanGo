import type { ReactNode } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  /** Optional control rendered on the right (e.g. a small action button). */
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, backHref, action }: PageHeaderProps) {
  return (
    <header className="mb-6">
      {backHref && (
        <Link
          href={backHref}
          className="-ml-2 mb-2 inline-flex items-center gap-0.5 rounded-lg px-2 py-1.5 text-sm font-medium text-text-muted transition-colors active:bg-black/5"
        >
          <Icon name="chevronLeft" size={18} />
          返回
        </Link>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-text">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm leading-relaxed text-text-muted">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0 pt-1">{action}</div>}
      </div>
    </header>
  );
}
