import { Suspense } from "react";
import { StoreDashboard } from "@/components/store/StoreDashboard";
import { PageLoading } from "@/components/ui/Spinner";

export default function StoreDashboardPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <StoreDashboard />
    </Suspense>
  );
}
