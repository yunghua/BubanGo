import type { Shift } from "@/types";

export const mockShifts: Shift[] = [
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
    applicantCount: 2,
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
    applicantCount: 0,
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
    status: "filled",
    applicantCount: 3,
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
    applicantCount: 1,
  },
];

export function getShiftById(id: string): Shift | undefined {
  return mockShifts.find((shift) => shift.id === id);
}

export function getShiftsByShopId(shopId: string): Shift[] {
  return mockShifts.filter((shift) => shift.shopId === shopId);
}
