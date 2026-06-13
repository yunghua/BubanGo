"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { ApplicationCard } from "@/components/applications/ApplicationCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
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

  return (
    <>
      {showSuccess && (
        <Alert variant="success">申請已送出，等待店家審核中。</Alert>
      )}

      <PageHeader
        title="申請紀錄"
        subtitle={`共 ${applications.length} 筆申請`}
      />

      {applications.length === 0 ? (
        <EmptyState
          title="還沒有申請紀錄"
          description="瀏覽附近缺班，找到適合的班次申請吧"
          action={
            <Link
              href="/shifts"
              className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white"
            >
              瀏覽缺班
            </Link>
          }
        />
      ) : (
        <>
          {accepted.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-3 text-sm font-semibold text-success">
                已錄取（{accepted.length}）
              </h2>
              {accepted.map((app) => (
                <Link key={app.id} href={`/shifts/${app.shiftId}`}>
                  <ApplicationCard
                    application={app}
                    shiftTitle={getShiftTitle(app.shiftId)}
                  />
                </Link>
              ))}
            </section>
          )}

          {pending.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-3 text-sm font-semibold text-warning">
                審核中（{pending.length}）
              </h2>
              {pending.map((app) => (
                <Link key={app.id} href={`/shifts/${app.shiftId}`}>
                  <ApplicationCard
                    application={app}
                    shiftTitle={getShiftTitle(app.shiftId)}
                  />
                </Link>
              ))}
            </section>
          )}

          {rejected.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-text-muted">
                未錄取（{rejected.length}）
              </h2>
              {rejected.map((app) => (
                <Link key={app.id} href={`/shifts/${app.shiftId}`}>
                  <ApplicationCard
                    application={app}
                    shiftTitle={getShiftTitle(app.shiftId)}
                  />
                </Link>
              ))}
            </section>
          )}
        </>
      )}
    </>
  );
}
