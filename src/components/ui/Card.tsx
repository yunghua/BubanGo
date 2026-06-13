import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  /** Adds press/hover affordance when the card sits inside a parent <Link>. */
  interactive?: boolean;
}

export function Card({ children, className, onClick, interactive }: CardProps) {
  const clickable = Boolean(onClick) || interactive;

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface p-4 shadow-sm",
        clickable &&
          "transition-all hover:border-primary/30 active:scale-[0.99] active:bg-black/[0.015]",
        className
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}
