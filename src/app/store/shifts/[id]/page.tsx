import { Suspense, use } from "react";
import { StoreShiftDetail } from "@/components/store/StoreShiftDetail";

interface StoreShiftDetailPageProps {
  params: Promise<{ id: string }>;
}

function StoreShiftDetailContent({ id }: { id: string }) {
  return <StoreShiftDetail shiftId={id} />;
}

export default function StoreShiftDetailPage({
  params,
}: StoreShiftDetailPageProps) {
  const { id } = use(params);

  return (
    <Suspense fallback={<p className="text-sm text-text-muted">載入中...</p>}>
      <StoreShiftDetailContent id={id} />
    </Suspense>
  );
}
