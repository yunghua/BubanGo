import type { Application } from "@/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import {
  formatRelativeTime,
  getApplicationStatusLabel,
  getInitial,
} from "@/lib/utils";

interface ApplicationCardProps {
  application: Application;
  shiftTitle?: string;
  showWorkerInfo?: boolean;
}

function getStatusVariant(status: Application["status"]) {
  switch (status) {
    case "accepted":
      return "success" as const;
    case "rejected":
      return "muted" as const;
    default:
      return "warning" as const;
  }
}

export function ApplicationCard({
  application,
  shiftTitle,
  showWorkerInfo = false,
}: ApplicationCardProps) {
  return (
    <Card interactive={!showWorkerInfo} className="mb-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          {showWorkerInfo && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
              {getInitial(application.workerName)}
            </div>
          )}
          <div className="min-w-0">
            {shiftTitle && (
              <p className="truncate font-semibold text-text">{shiftTitle}</p>
            )}
            {showWorkerInfo ? (
              <>
                <p className="font-semibold text-text">{application.workerName}</p>
                <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-text-muted">
                  <Icon name="phone" size={13} className="shrink-0" />
                  {application.workerPhone || "未提供電話"}
                </p>
              </>
            ) : (
              <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-text-muted">
                <Icon name="clock" size={13} className="shrink-0" />
                申請於 {formatRelativeTime(application.appliedAt)}
              </p>
            )}
          </div>
        </div>
        <Badge variant={getStatusVariant(application.status)} className="shrink-0">
          {getApplicationStatusLabel(application.status)}
        </Badge>
      </div>
    </Card>
  );
}
