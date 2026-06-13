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
import { updateWorkerProfile } from "@/lib/auth/profile-service";

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
        <Card className="mb-6 text-center text-text-muted">
          找不到打工者資料，請重新登入。
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
      <PageHeader title="個人資料" subtitle="讓店家更了解你" />

      <Card className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl">
          👤
        </div>
        <p className="text-lg font-semibold">{worker.name}</p>
        <p className="text-sm text-text-muted">{worker.phone || "尚未填寫手機"}</p>
      </Card>

      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

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
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Input
          label="可工作地區"
          placeholder="例：台北市大安區、信義區"
          value={areasText}
          onChange={(e) => setAreasText(e.target.value)}
        />
        <Textarea
          label="工作經驗"
          rows={4}
          value={experience}
          onChange={(e) => setExperience(e.target.value)}
        />

        <Button type="submit" fullWidth size="lg" className="mt-2" disabled={saving}>
          {saving ? "儲存中..." : "儲存資料"}
        </Button>
      </form>

      <div className="mt-4">
        <LogoutButton />
      </div>
    </>
  );
}
