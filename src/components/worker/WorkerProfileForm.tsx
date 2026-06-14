"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button, LinkButton } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Icon } from "@/components/ui/Icon";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { LineBindingCard } from "@/components/line/LineBindingCard";
import { useBubanGoData } from "@/hooks/useBubanGoData";
import { updateWorkerProfile } from "@/lib/auth/profile-service";
import { getInitial } from "@/lib/utils";

export function WorkerProfileForm() {
  const { data, refresh } = useBubanGoData();
  const worker = data.workers.find((w) => w.id === data.session.currentWorkerId);

  const [name, setName] = useState(worker?.name ?? "");
  const [phone, setPhone] = useState(worker?.phone ?? "");
  const [areasText, setAreasText] = useState(worker?.areas.join("、") ?? "");
  const [experience, setExperience] = useState(worker?.experience ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!worker) {
    return (
      <>
        <PageHeader title="個人資料" subtitle="讓店家更了解你" />
        <Card className="mb-4 flex flex-col items-center gap-4 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon name="user" size={28} />
          </div>
          <p className="text-text-muted">
            還沒有打工者資料，先完成設定就能開始申請缺班。
          </p>
          <LinkButton href="/onboarding/worker" fullWidth>
            完成打工者設定
          </LinkButton>
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
      setError("請輸入姓名");
      return;
    }

    setSaving(true);
    try {
      await updateWorkerProfile(worker!.id, {
        name: name.trim(),
        phone: phone.trim(),
        areasText: areasText.trim(),
        experience: experience.trim(),
      });
      await refresh();
      setMessage("已儲存個人資料");
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存失敗，請稍後再試");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="個人資料" subtitle="資料越完整，越容易被店家選中" />

      <Card className="mb-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
            {getInitial(worker.name)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-text">{worker.name}</p>
            <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-text-muted">
              <Icon name="phone" size={14} className="shrink-0" />
              {worker.phone || "尚未填寫手機"}
            </p>
          </div>
        </div>
        {worker.areas.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
            {worker.areas.map((area) => (
              <span
                key={area}
                className="inline-flex items-center gap-1 rounded-full bg-secondary-light px-2.5 py-1 text-xs font-medium text-secondary"
              >
                <Icon name="mapPin" size={12} />
                {area}
              </span>
            ))}
          </div>
        )}
      </Card>

      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      <h2 className="mb-3 text-sm font-semibold text-text-muted">編輯資料</h2>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <Input
          label="姓名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label="手機"
          type="tel"
          placeholder="0987-654-321"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Input
          label="可工作地區"
          placeholder="例：台北市大安區、信義區"
          hint="用、或逗號分隔多個地區"
          value={areasText}
          onChange={(e) => setAreasText(e.target.value)}
        />
        <Textarea
          label="工作經驗"
          rows={4}
          placeholder="簡述你的相關打工經驗"
          hint="讓店家快速了解你能勝任哪些工作"
          value={experience}
          onChange={(e) => setExperience(e.target.value)}
        />

        <Button type="submit" fullWidth size="lg" className="mt-2" disabled={saving}>
          {saving ? "儲存中…" : "儲存資料"}
        </Button>
      </form>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-text-muted">LINE 連動</h2>
        <LineBindingCard />
      </div>

      <div className="mt-8 border-t border-border pt-6">
        <LogoutButton />
      </div>
    </>
  );
}
