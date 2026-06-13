import type { Application, BubanGoData, Session, Shift } from "@/types";
import { mockShops } from "@/lib/mock/shops";
import { mockWorkers } from "@/lib/mock/workers";

const seedShifts: Omit<Shift, "applicantCount">[] = [
  {
    id: "shift-1",
    shopId: "shop-1",
    shopName: "好飲茶飲店",
    date: "2026-06-12",
    startTime: "14:00",
    endTime: "17:00",
    hourlyRate: 200,
    location: "台北市大安區復興南路一段 100 號",
    description: "協助點單、備料、包裝飲料，需能站立 3 小時",
    requiredWorkers: 1,
    status: "open",
  },
  {
    id: "shift-2",
    shopId: "shop-1",
    shopName: "好飲茶飲店",
    date: "2026-06-13",
    startTime: "18:00",
    endTime: "21:00",
    hourlyRate: 220,
    location: "台北市大安區復興南路一段 100 號",
    description: "晚班尖峰時段支援，需有飲料店經驗",
    requiredWorkers: 2,
    status: "open",
  },
  {
    id: "shift-3",
    shopId: "shop-2",
    shopName: "阿嬤滷味",
    date: "2026-06-14",
    startTime: "17:00",
    endTime: "20:00",
    hourlyRate: 190,
    location: "新北市板橋區文化路二段 50 號",
    description: "協助備料、包裝、收銀，可站可坐",
    requiredWorkers: 1,
    status: "matched",
  },
  {
    id: "shift-4",
    shopId: "shop-2",
    shopName: "阿嬤滷味",
    date: "2026-06-10",
    startTime: "17:00",
    endTime: "20:00",
    hourlyRate: 190,
    location: "新北市板橋區文化路二段 50 號",
    description: "協助備料、包裝、收銀",
    requiredWorkers: 1,
    status: "completed",
  },
];

const seedApplications: Application[] = [
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

const defaultSession: Session = {
  userId: "local-dev-user",
  role: null,
  currentShopId: "shop-1",
  currentWorkerId: "worker-1",
};

function withApplicantCounts(
  shifts: Omit<Shift, "applicantCount">[],
  applications: Application[]
): Shift[] {
  return shifts.map((shift) => ({
    ...shift,
    applicantCount: applications.filter((app) => app.shiftId === shift.id).length,
  }));
}

export function createSeedData(): BubanGoData {
  return {
    shops: mockShops,
    workers: mockWorkers,
    shifts: withApplicantCounts(seedShifts, seedApplications),
    applications: seedApplications,
    session: defaultSession,
  };
}
