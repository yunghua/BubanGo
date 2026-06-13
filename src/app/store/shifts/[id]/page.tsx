import { Suspense, use } from "react";
import { StoreShiftDetail } from "@/components/store/StoreShiftDetail";
import { PageLoading } from "@/components/ui/Spinner";

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
    <Suspense fallback={<PageLoading />}>
      <StoreShiftDetailContent id={id} />
    </Suspense>
  );
}
