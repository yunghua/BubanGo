"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useBubanGoData } from "@/hooks/useBubanGoData";
import {
  calculateHours,
  formatCurrency,
  formatDate,
  formatHours,
  formatRelativeDay,
  formatTimeRange,
  getApplicationStatusLabel,
  getShiftStatusLabel,
} from "@/lib/utils";

interface ShiftDetailProps {
  shiftId: string;
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: IconName;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <Icon name={icon} size={18} className="mt-0.5 shrink-0 text-text-muted" />
      <div className="min-w-0">
        <dt className="text-xs text-text-muted">{label}</dt>
        <dd className="mt-0.5 font-medium leading-relaxed text-text">{children}</dd>
      </div>
    </div>
  );
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
      <>
        <PageHeader title="缺班詳情" backHref="/shifts" />
        <Card className="flex flex-col items-center gap-4 py-12 text-center text-text-muted">
          <Icon name="search" size={32} className="text-text-muted" />
          <p>找不到這個缺班，可能已被收起或媒合完成。</p>
          <Button onClick={() => router.push("/shifts")}>回到缺班列表</Button>
        </Card>
      </>
    );
  }

  const durationHours = calculateHours(shift.startTime, shift.endTime);
  const estimatedPay = shift.hourlyRate * durationHours;
  const relativeDay = formatRelativeDay(shift.date);
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
          {isSubmitting ? "申請中…" : "申請這個缺班"}
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
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Icon name="store" size={20} className="shrink-0 text-text-muted" />
            <p className="truncate text-xl font-bold text-text">{shift.shopName}</p>
          </div>
          <Badge variant={shift.status === "open" ? "default" : "muted"} dot className="shrink-0">
            {getShiftStatusLabel(shift.status)}
          </Badge>
        </div>

        <div className="mt-4 rounded-xl bg-primary-light p-4">
          <p className="text-3xl font-bold text-primary">
            {formatCurrency(shift.hourlyRate)}
            <span className="ml-1 text-base font-normal text-text-muted">/時</span>
          </p>
          <p className="mt-1 text-sm text-text-muted">
            做 {formatHours(durationHours)}，預估可拿{" "}
            <span className="font-semibold text-text">{formatCurrency(estimatedPay)}</span>
          </p>
        </div>

        <dl className="mt-5 space-y-4">
          <DetailRow icon="calendar" label="日期">
            <span className="inline-flex items-center gap-2">
              {formatDate(shift.date)}
              {relativeDay && (
                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                  {relativeDay}
                </span>
              )}
            </span>
          </DetailRow>
          <DetailRow icon="clock" label="時間">
            {formatTimeRange(shift.startTime, shift.endTime)}
          </DetailRow>
          <DetailRow icon="mapPin" label="地點">
            {shift.location}
          </DetailRow>
          <DetailRow icon="users" label="需求人數">
            {shift.requiredWorkers} 人
          </DetailRow>
          <DetailRow icon="briefcase" label="工作內容">
            {shift.description}
          </DetailRow>
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
