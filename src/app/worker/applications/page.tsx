import { Suspense } from "react";
import { WorkerApplicationsList } from "@/components/worker/WorkerApplicationsList";

export default function WorkerApplicationsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-text-muted">載入中...</p>}>
      <WorkerApplicationsList />
    </Suspense>
  );
}
