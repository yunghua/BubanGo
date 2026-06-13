import { cn } from "@/lib/utils";
import { Icon, type IconName } from "@/components/ui/Icon";

type AlertVariant = "success" | "error" | "info";

interface AlertProps {
  children: React.ReactNode;
  variant?: AlertVariant;
  className?: string;
}

const variantStyles: Record<AlertVariant, string> = {
  success: "border-success/30 bg-success/10 text-success",
  error: "border-red-300 bg-red-50 text-red-700",
  info: "border-primary/30 bg-primary/10 text-primary",
};

const variantIcon: Record<AlertVariant, IconName> = {
  success: "checkCircle",
  error: "alertCircle",
  info: "info",
};

export function Alert({ children, variant = "info", className }: AlertProps) {
  return (
    <div
      className={cn(
        "mb-4 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium",
        variantStyles[variant],
        className
      )}
      role="alert"
    >
      <Icon name={variantIcon[variant]} size={18} className="mt-px shrink-0" />
      <div className="flex-1 leading-relaxed">{children}</div>
    </div>
  );
}
