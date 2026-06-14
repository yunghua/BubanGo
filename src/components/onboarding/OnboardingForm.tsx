"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import { isTaiwanPhone } from "@/lib/validation";
import { useBubanGoData } from "@/hooks/useBubanGoData";
import {
  completeOnboarding,
  getSuggestedProfile,
  type OnboardingRole,
} from "@/lib/auth/onboarding-service";

function RoleCard({
  active,
  icon,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  icon: IconName;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition-colors",
        active ? "border-primary bg-primary/5" : "border-border bg-surface"
      )}
    >
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors",
          active ? "bg-primary text-white" : "bg-primary/10 text-primary"
        )}
      >
        <Icon name={icon} size={22} />
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-text">{title}</p>
        <p className="text-sm text-text-muted">{subtitle}</p>
      </div>
      {active && (
        <Icon name="checkCircle" size={20} className="ml-auto shrink-0 text-primary" />
      )}
    </button>
  );
}

export function OnboardingForm() {
  const router = useRouter();
  const { data, refresh } = useBubanGoData();
  const alreadyOnboarded = Boolean(data.session.role);

  const [role, setRole] = useState<OnboardingRole | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Landed here already onboarded (role set) → go to their home.
  useEffect(() => {
    if (alreadyOnboarded) {
      router.replace(data.session.role === "shop" ? "/store" : "/shifts");
    }
  }, [alreadyOnboarded, data.session.role, router]);

  // Best-effort prefill from LINE metadata (display name often arrives via OIDC).
  useEffect(() => {
    let active = true;
    getSuggestedProfile().then((s) => {
      if (!active) return;
      setDisplayName((prev) => prev || s.displayName);
      setPhone((prev) => prev || s.phone);
    });
    return () => {
      active = false;
    };
  }, []);

  if (alreadyOnboarded) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 text-text-muted">
        <Spinner className="h-6 w-6 text-primary" />
        <p className="text-sm">正在前往…</p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!role) {
      setError("請先選擇身分");
      return;
    }
    if (!displayName.trim()) {
      setError(role === "shop_owner" ? "請輸入店家名稱" : "請輸入你的名字");
      return;
    }
    if (!isTaiwanPhone(phone)) {
      setError("請輸入有效的台灣電話號碼");
      return;
    }
    if (role === "shop_owner" && !address.trim()) {
      setError("請輸入店家地址");
      return;
    }

    setSubmitting(true);
    try {
      await completeOnboarding({
        role,
        displayName: displayName.trim(),
        phone: phone.trim(),
        address: address.trim(),
      });
      await refresh();
      router.replace(role === "shop_owner" ? "/store" : "/shifts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "完成設定失敗，請稍後再試");
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader title="完成設定" subtitle="選擇身分並填寫聯絡資料，即可開始使用" />

      {error && <Alert variant="error">{error}</Alert>}

      <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
        <div>
          <p className="mb-2 text-sm font-medium text-text">我的身分</p>
          <div className="grid gap-3">
            <RoleCard
              active={role === "shop_owner"}
              icon="store"
              title="我要找人"
              subtitle="我是店家，要發布缺班找人手"
              onClick={() => setRole("shop_owner")}
            />
            <RoleCard
              active={role === "worker"}
              icon="search"
              title="我要補班"
              subtitle="我是打工者，要找附近的缺班"
              onClick={() => setRole("worker")}
            />
          </div>
        </div>

        {role && (
          <>
            <Input
              label={role === "shop_owner" ? "店家名稱" : "你的名字"}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={role === "shop_owner" ? "例：好飲茶飲店" : "你的姓名"}
              required
            />
            <Input
              label="聯絡電話"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0987-654-321"
              hint="作為聯絡用，不會作為登入帳號"
              required
            />
            {role === "shop_owner" && (
              <Input
                label="店家地址"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="例：台北市大安區復興南路一段 100 號"
                required
              />
            )}

            <Button type="submit" fullWidth size="lg" disabled={submitting}>
              {submitting ? (
                "設定中…"
              ) : (
                <>
                  <Icon name="check" size={18} />
                  完成設定
                </>
              )}
            </Button>
          </>
        )}
      </form>
    </>
  );
}
