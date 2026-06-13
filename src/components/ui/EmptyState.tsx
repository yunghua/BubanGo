import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Custom icon node; defaults to an inbox glyph. */
  icon?: ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon ?? <Icon name="inbox" size={30} />}
      </div>
      <h3 className="text-lg font-semibold text-text">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-text-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
