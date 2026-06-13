"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { ShiftCard } from "@/components/shifts/ShiftCard";
import { useBubanGoData } from "@/hooks/useBubanGoData";
import { getShiftStatusLabel } from "@/lib/utils";

export function StoreDashboard() {
  const searchParams = useSearchParams();
  const { data } = useBubanGoData();

  const currentShop = data.shops.find(
    (shop) => shop.id === data.session.currentShopId
  );

  if (!currentShop) {
    return (
      <div className="py-12 text-center">
        <p className="text-text-muted">還沒有店家資料</p>
        <LinkButton href="/onboarding/shop" className="mt-4">
          完成店家設定
        </LinkButton>
      </div>
    );
  }

  const shifts = data.shifts.filter((shift) => shift.shopId === currentShop.id);
  const openShifts = shifts.filter((s) => s.status === "open");
  const activeShifts = shifts.filter((s) => s.status !== "completed");

  const otherShifts = data.shifts
    .filter((shift) => shift.shopId !== currentShop.id && shift.status === "open")
    .slice(0, 2);

  const showSuccess = searchParams.get("success") === "shift-created";

  return (
    <>
      {showSuccess && (
        <Alert variant="success">缺班發布成功！打工者現在可以在缺班列表看到它了。</Alert>
      )}

      <PageHeader title={currentShop.name} subtitle="店家後台" />

      <Card className="mb-6">
        <p className="text-sm text-text-muted">{currentShop.address}</p>
        <p className="mt-1 text-sm text-text-muted">{currentShop.phone}</p>
        <Link
          href="/store/settings"
          className="mt-3 inline-block text-sm font-medium text-primary"
        >
          編輯店家資料 →
        </Link>
      </Card>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Card className="text-center">
          <p className="text-2xl font-bold text-primary">{openShifts.length}</p>
          <p className="text-xs text-text-muted">招募中</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-secondary">{activeShifts.length}</p>
          <p className="text-xs text-text-muted">進行中</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-text">
            {shifts.reduce((sum, s) => sum + s.applicantCount, 0)}
          </p>
          <p className="text-xs text-text-muted">總申請</p>
        </Card>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">我的缺班</h2>
        <LinkButton href="/store/shifts/new" size="sm">
          + 發布缺班
        </LinkButton>
      </div>

      {shifts.length === 0 ? (
        <Card className="py-8 text-center">
          <p className="text-text-muted">尚無缺班，立即發布第一個缺班吧！</p>
          <LinkButton href="/store/shifts/new" className="mt-4" size="sm">
            發布缺班
          </LinkButton>
        </Card>
      ) : (
        shifts.map((shift) => (
          <Link key={shift.id} href={`/store/shifts/${shift.id}`}>
            <Card className="mb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{shift.date}</p>
                  <p className="text-sm text-text-muted">
                    {shift.startTime} – {shift.endTime}
                  </p>
                </div>
                <div className="text-right">
                  <Badge>{getShiftStatusLabel(shift.status)}</Badge>
                  <p className="mt-1 text-xs text-text-muted">
                    {shift.applicantCount} 人申請
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        ))
      )}

      {otherShifts.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">附近其他缺班</h2>
          {otherShifts.map((shift) => (
            <ShiftCard key={shift.id} shift={shift} />
          ))}
        </div>
      )}
    </>
  );
}
