"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavRole = "worker" | "shop";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const workerNav: NavItem[] = [
  { href: "/shifts", label: "缺班", icon: "🔍" },
  { href: "/worker/applications", label: "申請", icon: "📝" },
  { href: "/worker/profile", label: "我的", icon: "👤" },
];

const shopNav: NavItem[] = [
  { href: "/store", label: "後台", icon: "🏪" },
  { href: "/store/shifts/new", label: "發布", icon: "➕" },
  { href: "/shifts", label: "瀏覽", icon: "🔍" },
];

interface BottomNavProps {
  role: NavRole;
}

export function BottomNav({ role }: BottomNavProps) {
  const pathname = usePathname();
  const items = role === "shop" ? shopNav : workerNav;

  return (
    <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 border-t border-border bg-surface">
      <div className="flex items-center justify-around px-2 py-2">
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-lg py-2 text-xs transition-colors",
                isActive ? "text-primary font-semibold" : "text-text-muted"
              )}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
