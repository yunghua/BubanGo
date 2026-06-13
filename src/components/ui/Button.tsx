import Link from "next/link";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

interface LinkButtonProps {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white shadow-sm shadow-primary/25 hover:bg-primary-dark active:bg-primary-dark",
  secondary: "bg-secondary text-white shadow-sm shadow-secondary/20 hover:opacity-90",
  outline: "border-2 border-primary text-primary bg-transparent hover:bg-primary/5",
  ghost: "text-text-muted hover:bg-black/5",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 py-2 text-sm",
  md: "min-h-12 px-4 py-3 text-base",
  lg: "min-h-14 px-6 py-4 text-lg",
};

const baseStyles =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && "w-full",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  children,
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      className={cn(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && "w-full",
        className
      )}
    >
      {children}
    </Link>
  );
}
