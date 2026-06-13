import { Suspense } from "react";
import { StoreDashboard } from "@/components/store/StoreDashboard";

export default function StoreDashboardPage() {
  return (
    <Suspense fallback={<p className="text-sm text-text-muted">載入中...</p>}>
      <StoreDashboard />
    </Suspense>
  );
}
