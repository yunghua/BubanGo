"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useBubanGoData } from "@/hooks/useBubanGoData";
import { ensureWorkerForCurrentUser } from "@/lib/auth/onboarding-service";

export function WorkerOnboardingForm() {
  const router = useRouter();
  const { data, refresh } = useBubanGoData();
  const hasWorker = Boolean(data.session.currentWorkerId);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [experience, setExperience] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // A worker row already exists → onboarding isn't needed; go browse shifts.
  useEffect(() => {
    if (hasWorker) router.replace("/shifts");
  }, [hasWorker, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("請輸入姓名");
      return;
    }
    setSubmitting(true);
    try {
      await ensureWorkerForCurrentUser({
        name: name.trim(),
        phone: phone.trim(),
        area: area.trim(),
        experience: experience.trim(),
      });
      await refresh();
      router.replace("/shifts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存失敗，請稍後再試");
      setSubmitting(false);
    }
  }

  if (hasWorker) {
    return <p className="text-sm text-text-muted">已有打工者資料，正在前往缺班列表…</p>;
  }

  return (
    <>
      <PageHeader title="完成個人設定" subtitle="再補幾項資料就完成帳號設定" />
      <Alert variant="info">我們還需要一些資料來完成你的打工者帳號設定。</Alert>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        {error && <Alert variant="error">{error}</Alert>}
        <Input
          label="姓名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="你的姓名"
          required
        />
        <Input
          label="手機"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="0987-654-321"
        />
        <Input
          label="可工作地區"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          placeholder="例：台北市大安區、信義區"
        />
        <Textarea
          label="工作經驗"
          rows={4}
          value={experience}
          onChange={(e) => setExperience(e.target.value)}
          placeholder="簡述你的相關打工經驗"
        />
        <Button type="submit" fullWidth size="lg" className="mt-2" disabled={submitting}>
          {submitting ? "儲存中..." : "完成設定"}
        </Button>
      </form>
    </>
  );
}
