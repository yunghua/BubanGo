import { Suspense, use } from "react";
import { ShiftDetail } from "@/components/shifts/ShiftDetail";
import { PageLoading } from "@/components/ui/Spinner";

interface ShiftDetailPageProps {
  params: Promise<{ id: string }>;
}

function ShiftDetailContent({ id }: { id: string }) {
  return <ShiftDetail shiftId={id} />;
}

export default function ShiftDetailPage({ params }: ShiftDetailPageProps) {
  const { id } = use(params);

  return (
    <Suspense fallback={<PageLoading />}>
      <ShiftDetailContent id={id} />
    </Suspense>
  );
}
