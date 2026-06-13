"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useBubanGoData } from "@/hooks/useBubanGoData";
import { ensureShopForCurrentUser } from "@/lib/auth/onboarding-service";

export function ShopOnboardingForm() {
  const router = useRouter();
  const { data, refresh } = useBubanGoData();
  const hasShop = Boolean(data.session.currentShopId);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // A shop already exists → onboarding isn't needed; go to the dashboard.
  useEffect(() => {
    if (hasShop) router.replace("/store");
  }, [hasShop, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("請輸入店家名稱");
      return;
    }
    if (!address.trim()) {
      setError("請輸入店家地址");
      return;
    }
    setSubmitting(true);
    try {
      await ensureShopForCurrentUser({
        name: name.trim(),
        address: address.trim(),
        area: area.trim(),
        description: description.trim(),
      });
      await refresh();
      router.replace("/store");
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存失敗，請稍後再試");
      setSubmitting(false);
    }
  }

  if (hasShop) {
    return <p className="text-sm text-text-muted">已有店家資料，正在前往後台…</p>;
  }

  return (
    <>
      <PageHeader title="完成店家設定" subtitle="再補幾項資料就完成帳號設定" />
      <Alert variant="info">我們還需要一些資料來完成你的店家帳號設定。</Alert>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        {error && <Alert variant="error">{error}</Alert>}
        <Input
          label="店家名稱"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例：好飲茶飲店"
          required
        />
        <Input
          label="店家地址"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="例：台北市大安區復興南路一段 100 號"
          required
        />
        <Input
          label="服務地區"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          placeholder="例：台北市大安區"
        />
        <Textarea
          label="店家簡介"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="簡單介紹你的店家"
        />
        <Button type="submit" fullWidth size="lg" className="mt-2" disabled={submitting}>
          {submitting ? "儲存中..." : "完成設定"}
        </Button>
      </form>
    </>
  );
}
