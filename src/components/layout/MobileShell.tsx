interface MobileShellProps {
  children: React.ReactNode;
  showNav?: boolean;
}

export function MobileShell({ children, showNav = false }: MobileShellProps) {
  return (
    <div className="mx-auto min-h-dvh max-w-md bg-background">
      <main className="px-4 pb-8 pt-4">{children}</main>
      {showNav && (
        <div className="h-16" aria-hidden />
      )}
    </div>
  );
}
