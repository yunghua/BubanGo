"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { ShiftCard } from "@/components/shifts/ShiftCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { useBubanGoData } from "@/hooks/useBubanGoData";

export function ShiftsList() {
  const { data } = useBubanGoData();
  const openShifts = data.shifts.filter((shift) => shift.status === "open");

  return (
    <>
      <PageHeader
        title="附近缺班"
        subtitle={`目前有 ${openShifts.length} 個缺班正在招募`}
      />

      {openShifts.length === 0 ? (
        <EmptyState
          title="目前沒有缺班"
          description="稍後再來看看，或請店家發布新的缺班"
        />
      ) : (
        openShifts.map((shift) => <ShiftCard key={shift.id} shift={shift} />)
      )}
    </>
  );
}
