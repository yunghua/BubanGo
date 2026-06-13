import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="載入中"
      className={cn(
        "inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent",
        className
      )}
    />
  );
}

/** Centered loading state for full-page Suspense fallbacks. */
export function PageLoading({ label = "載入中…" }: { label?: string }) {
  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-3 text-text-muted">
      <Spinner className="h-7 w-7 text-primary" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
