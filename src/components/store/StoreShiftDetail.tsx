"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Icon } from "@/components/ui/Icon";
import { PageLoading } from "@/components/ui/Spinner";
import { ApplicationCard } from "@/components/applications/ApplicationCard";
import { useBubanGoData } from "@/hooks/useBubanGoData";
import {
  formatCurrency,
  formatDate,
  formatRelativeDay,
  formatTimeRange,
  getShiftStatusLabel,
} from "@/lib/utils";

interface StoreShiftDetailProps {
  shiftId: string;
}

export function StoreShiftDetail({ shiftId }: StoreShiftDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, acceptApplication, rejectApplication } = useBubanGoData();
  const [actionError, setActionError] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const shift = data.shifts.find((s) => s.id === shiftId);
  const applications = data.applications.filter((app) => app.shiftId === shiftId);
  const isOwner = !!shift && shift.shopId === data.session.currentShopId;
  const shouldRedirect = !!shift && !isOwner;

  // A non-owner (another shop, a worker, or any other signed-in user) must not
  // see the management shell — send them to the public shift detail page.
  useEffect(() => {
    if (shouldRedirect) {
      router.replace(`/shifts/${shiftId}`);
    }
  }, [shouldRedirect, router, shiftId]);

  if (!shift) {
    return (
      <>
        <PageHeader title="缺班管理" backHref="/store" />
        <Card className="flex flex-col items-center gap-4 py-12 text-center text-text-muted">
          <Icon name="search" size={32} />
          <p>找不到此缺班</p>
          <Button onClick={() => router.push("/store")}>回到店家後台</Button>
        </Card>
      </>
    );
  }

  if (!isOwner) {
    // Redirect is in flight (effect above); render loading, never the shell.
    return <PageLoading />;
  }

  const successAction = searchParams.get("success");
  const relativeDay = formatRelativeDay(shift.date);
  const pendingCount = applications.filter((a) => a.status === "pending").length;

  async function handleAccept(applicationId: string) {
    setActionError("");
    setProcessingId(applicationId);
    try {
      await acceptApplication(applicationId);
      router.replace(`/store/shifts/${shiftId}?success=accepted`);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "操作失敗，請稍後再試"
      );
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(applicationId: string) {
    setActionError("");
    setProcessingId(applicationId);
    try {
      await rejectApplication(applicationId);
      router.replace(`/store/shifts/${shiftId}?success=rejected`);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "操作失敗，請稍後再試"
      );
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <>
      <PageHeader title="缺班管理" backHref="/store" />

      {successAction === "accepted" && (
        <Alert variant="success">已接受申請，缺班狀態已更新為「已媒合」。</Alert>
      )}
      {successAction === "rejected" && <Alert variant="info">已婉拒此申請。</Alert>}
      {actionError && <Alert variant="error">{actionError}</Alert>}

      <Card className="mb-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <p className="text-lg font-bold text-text">{formatDate(shift.date)}</p>
            {relativeDay && (
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                {relativeDay}
              </span>
            )}
          </div>
          <Badge variant={shift.status === "open" ? "default" : "muted"} dot className="shrink-0">
            {getShiftStatusLabel(shift.status)}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-background p-3">
            <p className="flex items-center gap-1.5 text-xs text-text-muted">
              <Icon name="clock" size={14} />
              時間
            </p>
            <p className="mt-1 font-semibold text-text">
              {formatTimeRange(shift.startTime, shift.endTime)}
            </p>
          </div>
          <div className="rounded-xl bg-primary-light p-3">
            <p className="flex items-center gap-1.5 text-xs text-text-muted">
              <Icon name="wage" size={14} />
              時薪
            </p>
            <p className="mt-1 font-bold text-primary">
              {formatCurrency(shift.hourlyRate)}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3 text-sm">
          <p className="flex gap-2">
            <Icon name="mapPin" size={16} className="mt-0.5 shrink-0 text-text-muted" />
            <span className="text-text">{shift.location}</span>
          </p>
          <p className="flex gap-2">
            <Icon name="users" size={16} className="mt-0.5 shrink-0 text-text-muted" />
            <span className="text-text">需求 {shift.requiredWorkers} 人</span>
          </p>
          <p className="flex gap-2">
            <Icon name="briefcase" size={16} className="mt-0.5 shrink-0 text-text-muted" />
            <span className="leading-relaxed text-text">{shift.description}</span>
          </p>
        </div>
      </Card>

      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-text">申請者</h2>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-sm font-medium text-text-muted">
          {applications.length}
        </span>
        {pendingCount > 0 && (
          <span className="ml-auto text-sm font-medium text-primary">
            {pendingCount} 筆待審核
          </span>
        )}
      </div>

      {applications.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-10 text-center text-text-muted">
          <Icon name="users" size={28} />
          <p>還沒有人申請，發布後稍等一下吧。</p>
        </Card>
      ) : (
        applications.map((app) => (
          <div key={app.id}>
            <ApplicationCard application={app} showWorkerInfo />
            {app.status === "pending" && shift.status === "open" && (
              <div className="mb-4 flex gap-2">
                <Button
                  fullWidth
                  disabled={processingId === app.id}
                  onClick={() => handleAccept(app.id)}
                >
                  {processingId === app.id ? (
                    "處理中…"
                  ) : (
                    <>
                      <Icon name="check" size={18} />
                      接受申請
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  fullWidth
                  disabled={processingId === app.id}
                  onClick={() => handleReject(app.id)}
                >
                  婉拒
                </Button>
              </div>
            )}
          </div>
        ))
      )}
    </>
  );
}
