interface MobileShellProps {
  children: React.ReactNode;
  showNav?: boolean;
}

export function MobileShell({ children, showNav = false }: MobileShellProps) {
  return (
    <div className="mx-auto min-h-dvh max-w-md bg-background sm:border-x sm:border-border">
      <main className="px-4 pb-8 pt-5">{children}</main>
      {showNav && (
        // Spacer so fixed nav (plus the safe-area inset) never overlaps content.
        <div className="h-[calc(4.5rem_+_env(safe-area-inset-bottom))]" aria-hidden />
      )}
    </div>
  );
}
