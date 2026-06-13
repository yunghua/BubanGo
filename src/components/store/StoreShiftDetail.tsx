"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { ApplicationCard } from "@/components/applications/ApplicationCard";
import { useBubanGoData } from "@/hooks/useBubanGoData";
import {
  formatCurrency,
  formatDate,
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

  if (!shift) {
    return (
      <div className="py-12 text-center text-text-muted">
        <p>找不到此缺班</p>
        <Button className="mt-4" onClick={() => router.push("/store")}>
          回到店家後台
        </Button>
      </div>
    );
  }

  const successAction = searchParams.get("success");

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
      {successAction === "rejected" && (
        <Alert variant="info">已婉拒此申請。</Alert>
      )}
      {actionError && <Alert variant="error">{actionError}</Alert>}

      <Card className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-lg font-semibold">{shift.shopName}</p>
            <p className="mt-1 text-sm text-text-muted">
              {formatDate(shift.date)} · {formatTimeRange(shift.startTime, shift.endTime)}
            </p>
          </div>
          <Badge>{getShiftStatusLabel(shift.status)}</Badge>
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <p>
            <span className="text-text-muted">時薪：</span>
            <span className="font-semibold text-primary">
              {formatCurrency(shift.hourlyRate)}
            </span>
          </p>
          <p>
            <span className="text-text-muted">地點：</span>
            {shift.location}
          </p>
          <p>
            <span className="text-text-muted">人數：</span>
            {shift.requiredWorkers} 人
          </p>
          <p>
            <span className="text-text-muted">內容：</span>
            {shift.description}
          </p>
        </div>
      </Card>

      <h2 className="mb-3 text-lg font-semibold">
        申請者（{applications.length}）
      </h2>

      {applications.length === 0 ? (
        <Card className="py-8 text-center text-text-muted">尚無申請者</Card>
      ) : (
        applications.map((app) => (
          <div key={app.id}>
            <ApplicationCard application={app} showWorkerInfo />
            {app.status === "pending" && shift.status === "open" && (
              <div className="mb-4 flex gap-2">
                <Button
                  size="sm"
                  fullWidth
                  disabled={processingId === app.id}
                  onClick={() => handleAccept(app.id)}
                >
                  接受
                </Button>
                <Button
                  size="sm"
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
