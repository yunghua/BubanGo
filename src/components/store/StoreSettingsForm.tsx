"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
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
        <Card className="mb-6 text-center text-text-muted">
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
      <PageHeader title="店家資料" subtitle="編輯你的店家資訊" backHref="/store" />

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
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <Button type="submit" fullWidth size="lg" className="mt-2" disabled={saving}>
          {saving ? "儲存中..." : "儲存"}
        </Button>
      </form>

      <div className="mt-4">
        <LogoutButton />
      </div>
    </>
  );
}
