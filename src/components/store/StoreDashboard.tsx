"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Shift } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Icon } from "@/components/ui/Icon";
import { ShiftCard } from "@/components/shifts/ShiftCard";
import { useBubanGoData } from "@/hooks/useBubanGoData";
import {
  formatDate,
  formatRelativeDay,
  formatTimeRange,
  getShiftStatusLabel,
} from "@/lib/utils";

function statusVariant(status: Shift["status"]) {
  switch (status) {
    case "open":
      return "default" as const;
    case "matched":
      return "success" as const;
    case "filled":
      return "warning" as const;
    default:
      return "muted" as const;
  }
}

export function StoreDashboard() {
  const searchParams = useSearchParams();
  const { data } = useBubanGoData();

  const currentShop = data.shops.find(
    (shop) => shop.id === data.session.currentShopId
  );

  if (!currentShop) {
    return (
      <>
        <PageHeader title="店家後台" />
        <Card className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon name="store" size={28} />
          </div>
          <p className="text-text-muted">
            還沒有店家資料，完成設定後就能開始發布缺班。
          </p>
          <LinkButton href="/onboarding/shop" fullWidth>
            完成店家設定
          </LinkButton>
        </Card>
      </>
    );
  }

  const shifts = data.shifts.filter((shift) => shift.shopId === currentShop.id);
  const openShifts = shifts.filter((s) => s.status === "open");
  const activeShifts = shifts.filter((s) => s.status !== "completed");
  const totalApplicants = shifts.reduce((sum, s) => sum + s.applicantCount, 0);

  const otherShifts = data.shifts
    .filter((shift) => shift.shopId !== currentShop.id && shift.status === "open")
    .slice(0, 2);

  const showSuccess = searchParams.get("success") === "shift-created";

  return (
    <>
      {showSuccess && (
        <Alert variant="success">
          缺班發布成功！打工者現在可以在缺班列表看到它了。
        </Alert>
      )}

      <PageHeader
        title={currentShop.name}
        subtitle="店家後台"
        action={
          <LinkButton href="/store/settings" variant="ghost" size="sm">
            編輯
          </LinkButton>
        }
      />

      <Card className="mb-5">
        <p className="flex items-start gap-2 text-sm text-text">
          <Icon name="mapPin" size={16} className="mt-0.5 shrink-0 text-text-muted" />
          {currentShop.address}
        </p>
        {currentShop.phone && (
          <p className="mt-2 flex items-center gap-2 text-sm text-text">
            <Icon name="phone" size={16} className="shrink-0 text-text-muted" />
            {currentShop.phone}
          </p>
        )}
      </Card>

      <Card className="mb-6 grid grid-cols-3 divide-x divide-border">
        <div className="px-1 text-center">
          <p className="text-2xl font-bold text-primary">{openShifts.length}</p>
          <p className="mt-0.5 text-xs text-text-muted">招募中</p>
        </div>
        <div className="px-1 text-center">
          <p className="text-2xl font-bold text-secondary">{activeShifts.length}</p>
          <p className="mt-0.5 text-xs text-text-muted">進行中</p>
        </div>
        <div className="px-1 text-center">
          <p className="text-2xl font-bold text-text">{totalApplicants}</p>
          <p className="mt-0.5 text-xs text-text-muted">總申請</p>
        </div>
      </Card>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text">我的缺班</h2>
        <LinkButton href="/store/shifts/new" size="sm">
          <Icon name="plus" size={16} />
          發布缺班
        </LinkButton>
      </div>

      {shifts.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon name="calendar" size={28} />
          </div>
          <p className="text-text-muted">還沒有缺班，立即發布第一個缺班吧！</p>
          <LinkButton href="/store/shifts/new">
            <Icon name="plus" size={16} />
            發布缺班
          </LinkButton>
        </Card>
      ) : (
        shifts.map((shift) => {
          const relativeDay = formatRelativeDay(shift.date);
          const hasApplicants = shift.applicantCount > 0;
          return (
            <Link
              key={shift.id}
              href={`/store/shifts/${shift.id}`}
              className="block"
            >
              <Card interactive className="mb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-text">
                        {formatDate(shift.date)}
                      </p>
                      {relativeDay && (
                        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                          {relativeDay}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-text-muted">
                      <Icon name="clock" size={14} className="shrink-0" />
                      {formatTimeRange(shift.startTime, shift.endTime)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Badge variant={statusVariant(shift.status)} dot>
                      {getShiftStatusLabel(shift.status)}
                    </Badge>
                    <span
                      className={
                        hasApplicants
                          ? "inline-flex items-center gap-1 text-xs font-semibold text-primary"
                          : "inline-flex items-center gap-1 text-xs text-text-muted"
                      }
                    >
                      <Icon name="users" size={13} />
                      {hasApplicants ? `${shift.applicantCount} 人申請` : "尚無申請"}
                    </span>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })
      )}

      {otherShifts.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-1 text-lg font-semibold text-text">附近其他缺班</h2>
          <p className="mb-3 text-sm text-text-muted">看看同業開出的條件</p>
          {otherShifts.map((shift) => (
            <ShiftCard key={shift.id} shift={shift} />
          ))}
        </div>
      )}
    </>
  );
}
