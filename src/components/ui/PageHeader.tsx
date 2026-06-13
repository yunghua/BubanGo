import Link from "next/link";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
}

export function PageHeader({ title, subtitle, backHref }: PageHeaderProps) {
  return (
    <header className="mb-6">
      {backHref && (
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-1 text-sm text-text-muted hover:text-text"
        >
          ← 返回
        </Link>
      )}
      <h1 className="text-2xl font-bold text-text">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
    </header>
  );
}
