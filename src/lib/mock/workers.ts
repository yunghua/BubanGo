import type { Worker } from "@/types";

export const mockWorkers: Worker[] = [
  {
    id: "worker-1",
    userId: "user-worker-1",
    name: "王小明",
    phone: "0987-654-321",
    areas: ["台北市大安區", "台北市信義區"],
    experience: "曾在飲料店工作 1 年，熟悉點單、備料、收銀",
  },
  {
    id: "worker-2",
    userId: "user-worker-2",
    name: "李小美",
    phone: "0966-112-233",
    areas: ["新北市板橋區", "新北市中和區"],
    experience: "餐飲業兼職 2 年，可配合晚班",
  },
];

export function getWorkerById(id: string): Worker | undefined {
  return mockWorkers.find((worker) => worker.id === id);
}
