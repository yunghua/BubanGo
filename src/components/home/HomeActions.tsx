"use client";

import { LinkButton } from "@/components/ui/Button";
import { LineLoginButton } from "@/components/auth/LineLoginButton";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { useBubanGoData } from "@/hooks/useBubanGoData";

/**
 * Home-page call-to-action area. Reads the session so the home screen reflects
 * auth state: a primary LINE Login for guests, or an "already signed in" panel
 * with a role-aware shortcut and a clear 登出 / 切換帳號 for testing accounts.
 */
export function HomeActions() {
  const { data } = useBubanGoData();
  const { userId, role } = data.session;

  if (!userId) {
    return (
      <div className="flex flex-col gap-3 pt-8">
        <LineLoginButton />
        <LinkButton href="/auth/login" variant="outline" size="lg" fullWidth>
          使用 Email 登入
        </LinkButton>
        <p className="text-center text-xs leading-relaxed text-text-muted">
          店家、打工者皆可使用；登入後再選擇身分
        </p>
      </div>
    );
  }

  const primary =
    role === "shop"
      ? { href: "/store", label: "前往店家後台" }
      : role === "worker"
        ? { href: "/shifts", label: "查看缺班" }
        : { href: "/onboarding", label: "完成設定" };

  return (
    <div className="flex flex-col gap-3 pt-8">
      <p className="text-center text-sm font-medium text-text">目前已登入</p>
      <LinkButton href={primary.href} size="lg" fullWidth>
        {primary.label}
      </LinkButton>
      <LogoutButton label="登出 / 切換帳號" />
      <p className="text-center text-xs leading-relaxed text-text-muted">
        想切換 LINE 帳號？請先登出再重新登入。
      </p>
    </div>
  );
}
