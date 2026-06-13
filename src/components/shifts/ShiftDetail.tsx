"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useBubanGoData } from "@/hooks/useBubanGoData";
import {
  calculateHours,
  formatCurrency,
  formatDate,
  formatTimeRange,
  getApplicationStatusLabel,
  getShiftStatusLabel,
} from "@/lib/utils";

interface ShiftDetailProps {
  shiftId: string;
}

export function ShiftDetail({ shiftId }: ShiftDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, applyForShift } = useBubanGoData();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const shift = data.shifts.find((s) => s.id === shiftId);
  const workerId = data.session.currentWorkerId;
  const existingApplication = data.applications.find(
    (app) =>
      app.shiftId === shiftId &&
      app.workerId === workerId &&
      app.status !== "rejected"
  );

  if (!shift) {
    return (
      <div className="py-12 text-center text-text-muted">
        <p>找不到此缺班</p>
        <Button className="mt-4" onClick={() => router.push("/shifts")}>
          回到缺班列表
        </Button>
      </div>
    );
  }

  const durationHours = calculateHours(shift.startTime, shift.endTime);
  const estimatedPay = shift.hourlyRate * durationHours;
  const showSuccess = searchParams.get("success") === "applied";

  async function handleApply() {
    setError("");
    setIsSubmitting(true);

    try {
      await applyForShift(shiftId);
      router.replace(`/shifts/${shiftId}?success=applied`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "申請失敗，請稍後再試");
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderActionButton(currentShift: NonNullable<typeof shift>) {
    // Not signed in: send them to login and back here to apply.
    if (!data.session.userId && currentShift.status === "open") {
      return (
        <LinkButton
          href={`/auth/login?redirect=/shifts/${shiftId}`}
          fullWidth
          size="lg"
        >
          登入後申請
        </LinkButton>
      );
    }

    if (existingApplication) {
      const label =
        existingApplication.status === "accepted"
          ? "已錄取此缺班"
          : `已申請（${getApplicationStatusLabel(existingApplication.status)}）`;

      return (
        <Button fullWidth size="lg" disabled>
          {label}
        </Button>
      );
    }

    if (currentShift.status === "open") {
      return (
        <Button fullWidth size="lg" disabled={isSubmitting} onClick={handleApply}>
          {isSubmitting ? "申請中..." : "申請這個缺班"}
        </Button>
      );
    }

    const disabledLabel =
      currentShift.status === "matched"
        ? "已媒合，無法申請"
        : currentShift.status === "filled"
          ? "已滿員"
          : "無法申請";

    return (
      <Button fullWidth size="lg" disabled>
        {disabledLabel}
      </Button>
    );
  }

  return (
    <>
      <PageHeader title="缺班詳情" backHref="/shifts" />

      {showSuccess && (
        <Alert variant="success">
          申請成功！可在「申請紀錄」查看審核狀態。
        </Alert>
      )}
      {error && <Alert variant="error">{error}</Alert>}

      <Card className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xl font-bold">{shift.shopName}</p>
            <p className="mt-1 text-sm text-text-muted">
              {formatDate(shift.date)}
            </p>
          </div>
          <Badge>{getShiftStatusLabel(shift.status)}</Badge>
        </div>

        <div className="mt-4 rounded-xl bg-background p-4">
          <p className="text-2xl font-bold text-primary">
            {formatCurrency(shift.hourlyRate)}
            <span className="text-sm font-normal text-text-muted">/時</span>
          </p>
          <p className="mt-1 text-sm text-text-muted">
            預估收入約 {formatCurrency(estimatedPay)}（{durationHours} 小時）
          </p>
        </div>

        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-text-muted">時間</dt>
            <dd className="font-medium">
              {formatTimeRange(shift.startTime, shift.endTime)}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">地點</dt>
            <dd className="font-medium">{shift.location}</dd>
          </div>
          <div>
            <dt className="text-text-muted">需求人數</dt>
            <dd className="font-medium">{shift.requiredWorkers} 人</dd>
          </div>
          <div>
            <dt className="text-text-muted">工作內容</dt>
            <dd className="font-medium leading-relaxed">{shift.description}</dd>
          </div>
        </dl>
      </Card>

      {renderActionButton(shift)}

      {showSuccess && (
        <Button
          variant="outline"
          fullWidth
          className="mt-3"
          onClick={() => router.push("/worker/applications")}
        >
          查看申請紀錄
        </Button>
      )}
    </>
  );
}
