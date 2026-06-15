"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Icon } from "@/components/ui/Icon";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { useBubanGoData } from "@/hooks/useBubanGoData";
import { updateShopProfile } from "@/lib/auth/profile-service";

export function StoreSettingsForm() {
  const { data, refresh } = useBubanGoData();
  const shop = data.shops.find((s) => s.id === data.session.currentShopId);

  const [name, setName] = useState(shop?.name ?? "");
  const [phone, setPhone] = useState(shop?.phone ?? "");
  const [address, setAddress] = useState(shop?.address ?? "");
  const [description, setDescription] = useState(shop?.description ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!shop) {
    return (
      <>
        <PageHeader title="店家資料" subtitle="編輯你的店家資訊" backHref="/store" />
        <Card className="mb-6 flex flex-col items-center gap-3 py-10 text-center text-text-muted">
          <Icon name="store" size={28} />
          找不到店家資料，請重新登入。
        </Card>
        <LogoutButton />
      </>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!name.trim()) {
      setError("請輸入店家名稱");
      return;
    }
    if (!address.trim()) {
      setError("請輸入店家地址");
      return;
    }

    setSaving(true);
    try {
      await updateShopProfile(shop!.id, shop!.userId, {
        name: name.trim(),
        address: address.trim(),
        description: description.trim(),
        phone: phone.trim(),
      });
      await refresh();
      setMessage("已儲存店家資料");
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存失敗，請稍後再試");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="店家資料" subtitle="這些資訊會顯示給打工者參考" backHref="/store" />

      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <Input
          label="店家名稱"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label="電話"
          type="tel"
          placeholder="0912-345-678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Input
          label="地址"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
        />
        <Textarea
          label="店家簡介"
          rows={3}
          placeholder="簡單介紹你的店家"
          hint="讓打工者快速認識你的店"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <Button type="submit" fullWidth size="lg" className="mt-2" disabled={saving}>
          {saving ? "儲存中…" : "儲存"}
        </Button>
      </form>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-text-muted">LINE 連動</h2>
        {/* Diagnostic: LineBindingCard temporarily disabled to test LIFF redirect on /store/settings */}
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-sm text-text-muted">
            LINE 通知功能即將推出，目前可先使用 LINE 登入。
          </p>
        </div>
      </div>

      <div className="mt-8 border-t border-border pt-6">
        <h2 className="mb-3 text-sm font-semibold text-text-muted">帳號</h2>
        <LogoutButton
          label="登出 / 切換帳號"
          hint="想切換 LINE 帳號？請先登出再重新登入。"
        />
      </div>
    </>
  );
}
