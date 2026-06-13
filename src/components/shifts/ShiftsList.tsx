"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { ShiftCard } from "@/components/shifts/ShiftCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { useBubanGoData } from "@/hooks/useBubanGoData";

export function ShiftsList() {
  const { data } = useBubanGoData();
  const openShifts = data.shifts
    .filter((shift) => shift.status === "open")
    // Soonest shifts first so the most relevant work is at the top.
    .sort((a, b) =>
      a.date === b.date
        ? a.startTime.localeCompare(b.startTime)
        : a.date.localeCompare(b.date)
    );

  return (
    <>
      <PageHeader
        title="附近缺班"
        subtitle={
          openShifts.length > 0
            ? `有 ${openShifts.length} 個缺班正在招募，找個順路的吧`
            : "看看附近有沒有適合的臨時班"
        }
      />

      {openShifts.length === 0 ? (
        <EmptyState
          icon={<Icon name="search" size={30} />}
          title="目前沒有招募中的缺班"
          description="這附近暫時沒有缺班，晚點再回來看看新的機會。"
        />
      ) : (
        openShifts.map((shift) => <ShiftCard key={shift.id} shift={shift} />)
      )}
    </>
  );
}
