"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "@/components/ui/Icon";

type NavRole = "worker" | "shop";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

const workerNav: NavItem[] = [
  { href: "/shifts", label: "找缺班", icon: "search" },
  { href: "/worker/applications", label: "申請", icon: "briefcase" },
  { href: "/worker/profile", label: "我的", icon: "user" },
];

const shopNav: NavItem[] = [
  { href: "/store", label: "後台", icon: "store" },
  { href: "/store/shifts/new", label: "發布", icon: "plus" },
  { href: "/shifts", label: "瀏覽", icon: "search" },
];

interface BottomNavProps {
  role: NavRole;
}

export function BottomNav({ role }: BottomNavProps) {
  const pathname = usePathname();
  const items = role === "shop" ? shopNav : workerNav;

  return (
    <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 border-t border-border bg-surface/95 backdrop-blur">
      <div className="flex items-center justify-around px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-xl py-1 text-xs transition-colors",
                isActive ? "text-primary" : "text-text-muted"
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                  isActive && "bg-primary/10"
                )}
              >
                <Icon name={item.icon} size={22} strokeWidth={isActive ? 2 : 1.75} />
              </span>
              <span className={isActive ? "font-semibold" : "font-medium"}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
