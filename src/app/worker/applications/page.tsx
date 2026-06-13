import { Suspense } from "react";
import { WorkerApplicationsList } from "@/components/worker/WorkerApplicationsList";
import { PageLoading } from "@/components/ui/Spinner";

export default function WorkerApplicationsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <WorkerApplicationsList />
    </Suspense>
  );
}
