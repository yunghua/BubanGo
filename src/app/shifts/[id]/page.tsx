import { Suspense, use } from "react";
import { ShiftDetail } from "@/components/shifts/ShiftDetail";

interface ShiftDetailPageProps {
  params: Promise<{ id: string }>;
}

function ShiftDetailContent({ id }: { id: string }) {
  return <ShiftDetail shiftId={id} />;
}

export default function ShiftDetailPage({ params }: ShiftDetailPageProps) {
  const { id } = use(params);

  return (
    <Suspense fallback={<p className="text-sm text-text-muted">載入中...</p>}>
      <ShiftDetailContent id={id} />
    </Suspense>
  );
}
