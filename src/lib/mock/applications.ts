import type { Application } from "@/types";

export const mockApplications: Application[] = [
  {
    id: "app-1",
    shiftId: "shift-1",
    workerId: "worker-1",
    workerName: "王小明",
    workerPhone: "0987-654-321",
    status: "pending",
    appliedAt: "2026-06-11T10:30:00",
  },
  {
    id: "app-2",
    shiftId: "shift-1",
    workerId: "worker-2",
    workerName: "李小美",
    workerPhone: "0966-112-233",
    status: "pending",
    appliedAt: "2026-06-11T11:00:00",
  },
  {
    id: "app-3",
    shiftId: "shift-3",
    workerId: "worker-1",
    workerName: "王小明",
    workerPhone: "0987-654-321",
    status: "accepted",
    appliedAt: "2026-06-09T14:00:00",
  },
  {
    id: "app-4",
    shiftId: "shift-4",
    workerId: "worker-2",
    workerName: "李小美",
    workerPhone: "0966-112-233",
    status: "accepted",
    appliedAt: "2026-06-08T09:00:00",
  },
];

export function getApplicationsByShiftId(shiftId: string): Application[] {
  return mockApplications.filter((app) => app.shiftId === shiftId);
}

export function getApplicationsByWorkerId(workerId: string): Application[] {
  return mockApplications.filter((app) => app.workerId === workerId);
}
