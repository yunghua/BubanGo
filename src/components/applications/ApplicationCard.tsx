import type { Application } from "@/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getApplicationStatusLabel } from "@/lib/utils";

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
    <Card className="mb-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          {shiftTitle && (
            <p className="font-semibold text-text">{shiftTitle}</p>
          )}
          {showWorkerInfo ? (
            <>
              <p className="font-semibold text-text">{application.workerName}</p>
              <p className="text-sm text-text-muted">{application.workerPhone}</p>
            </>
          ) : (
            <p className="text-sm text-text-muted">
              申請時間：{new Date(application.appliedAt).toLocaleString("zh-TW")}
            </p>
          )}
        </div>
        <Badge variant={getStatusVariant(application.status)}>
          {getApplicationStatusLabel(application.status)}
        </Badge>
      </div>
    </Card>
  );
}
