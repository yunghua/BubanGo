import Link from "next/link";
import type { Shift } from "@/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import {
  calculateHours,
  formatCurrency,
  formatDate,
  formatHours,
  formatRelativeDay,
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
    default:
      // completed / cancelled — settled states sit quietly in the background.
      return "muted" as const;
  }
}

export function ShiftCard({ shift }: ShiftCardProps) {
  const relativeDay = formatRelativeDay(shift.date);
  const duration = calculateHours(shift.startTime, shift.endTime);

  return (
    <Link href={`/shifts/${shift.id}`} className="block">
      <Card interactive className="mb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <Icon name="store" size={16} className="shrink-0 text-text-muted" />
            <p className="truncate font-semibold text-text">{shift.shopName}</p>
          </div>
          <Badge variant={getStatusVariant(shift.status)} dot className="shrink-0">
            {getShiftStatusLabel(shift.status)}
          </Badge>
        </div>

        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-2 text-sm">
            <Icon name="calendar" size={16} className="shrink-0 text-text-muted" />
            <span className="font-medium text-text">{formatDate(shift.date)}</span>
            {relativeDay && (
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                {relativeDay}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Icon name="clock" size={16} className="shrink-0" />
            <span className="text-text">{formatTimeRange(shift.startTime, shift.endTime)}</span>
            <span>· {formatHours(duration)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Icon name="mapPin" size={16} className="shrink-0" />
            <span className="truncate">{shift.location}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="text-xl font-bold text-primary">
            {formatCurrency(shift.hourlyRate)}
            <span className="ml-0.5 text-sm font-normal text-text-muted">/時</span>
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-text-muted">
            <Icon name="users" size={14} />
            {shift.applicantCount > 0 ? `${shift.applicantCount} 人申請` : "尚無人申請"}
          </span>
        </div>
      </Card>
    </Link>
  );
}
