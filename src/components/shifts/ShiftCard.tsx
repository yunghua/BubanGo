import Link from "next/link";
import type { Shift } from "@/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  formatCurrency,
  formatDate,
  formatTimeRange,
  getShiftStatusLabel,
} from "@/lib/utils";

interface ShiftCardProps {
  shift: Shift;
}

function getStatusVariant(status: Shift["status"]) {
  switch (status) {
    case "open":
      return "default" as const;
    case "matched":
      return "success" as const;
    case "filled":
      return "warning" as const;
    case "completed":
      return "success" as const;
    default:
      return "muted" as const;
  }
}

export function ShiftCard({ shift }: ShiftCardProps) {
  return (
    <Link href={`/shifts/${shift.id}`}>
      <Card className="mb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-text">{shift.shopName}</p>
            <p className="mt-0.5 text-sm text-text-muted">
              {formatDate(shift.date)} · {formatTimeRange(shift.startTime, shift.endTime)}
            </p>
          </div>
          <Badge variant={getStatusVariant(shift.status)}>
            {getShiftStatusLabel(shift.status)}
          </Badge>
        </div>

        <p className="mt-2 line-clamp-2 text-sm text-text-muted">{shift.description}</p>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-lg font-bold text-primary">
            {formatCurrency(shift.hourlyRate)}
            <span className="text-sm font-normal text-text-muted">/時</span>
          </span>
          <span className="text-xs text-text-muted">
            {shift.applicantCount > 0
              ? `${shift.applicantCount} 人申請`
              : "尚無申請"}
          </span>
        </div>
      </Card>
    </Link>
  );
}
