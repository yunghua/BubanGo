import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "muted";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  /** Shows a small leading dot — useful for live status labels. */
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  muted: "bg-gray-100 text-text-muted",
};

export function Badge({ children, variant = "default", className, dot }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        variantStyles[variant],
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
