"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Application } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { ApplicationCard } from "@/components/applications/ApplicationCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import { useBubanGoData } from "@/hooks/useBubanGoData";

export function WorkerApplicationsList() {
  const searchParams = useSearchParams();
  const { data } = useBubanGoData();
  const workerId = data.session.currentWorkerId;

  const applications = data.applications.filter(
    (app) => app.workerId === workerId
  );

  const pending = applications.filter((a) => a.status === "pending");
  const accepted = applications.filter((a) => a.status === "accepted");
  const rejected = applications.filter((a) => a.status === "rejected");

  const showSuccess = searchParams.get("success") === "applied";

  function getShiftTitle(shiftId: string) {
    return data.shifts.find((shift) => shift.id === shiftId)?.shopName;
  }

  function renderGroup(label: string, dotClass: string, items: Application[]) {
    if (items.length === 0) return null;
    return (
      <section className="mb-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <span className={cn("h-2 w-2 rounded-full", dotClass)} />
          <span className="text-text">{label}</span>
          <span className="text-text-muted">{items.length}</span>
        </h2>
        {items.map((app) => (
          <Link
            key={app.id}
            href={`/shifts/${app.shiftId}`}
            className="block"
          >
            <ApplicationCard
              application={app}
              shiftTitle={getShiftTitle(app.shiftId)}
            />
          </Link>
        ))}
      </section>
    );
  }

  return (
    <>
      {showSuccess && (
        <Alert variant="success">申請已送出，等待店家審核中。</Alert>
      )}

      <PageHeader
        title="申請紀錄"
        subtitle={
          applications.length > 0
            ? `共 ${applications.length} 筆申請`
            : "追蹤你申請過的每個缺班"
        }
      />

      {applications.length === 0 ? (
        <EmptyState
          icon={<Icon name="briefcase" size={30} />}
          title="還沒有申請紀錄"
          description="瀏覽附近缺班，找到適合的班次就送出申請吧。"
          action={<LinkButton href="/shifts">瀏覽缺班</LinkButton>}
        />
      ) : (
        <>
          {renderGroup("已錄取", "bg-success", accepted)}
          {renderGroup("審核中", "bg-warning", pending)}
          {renderGroup("未錄取", "bg-gray-300", rejected)}
        </>
      )}
    </>
  );
}
