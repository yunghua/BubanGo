import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /** Helper copy shown under the field when there's no error. */
  hint?: string;
}

export function Input({ label, error, hint, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.replace(/\s/g, "-").toLowerCase();

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-text">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          "w-full rounded-xl border border-border bg-surface px-4 py-3 text-base",
          "placeholder:text-text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
          error && "border-red-500",
          className
        )}
        {...props}
      />
      {error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : (
        hint && <p className="text-xs text-text-muted">{hint}</p>
      )}
    </div>
  );
}
