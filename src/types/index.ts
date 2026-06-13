export type UserRole = "shop" | "worker";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface Shop {
  id: string;
  userId: string;
  name: string;
  address: string;
  phone: string;
  description?: string;
}

export interface Worker {
  id: string;
  userId: string;
  name: string;
  phone: string;
  areas: string[];
  experience: string;
}

export type ShiftStatus = "open" | "matched" | "filled" | "completed" | "cancelled";
export type ApplicationStatus = "pending" | "accepted" | "rejected";

export interface Shift {
  id: string;
  shopId: string;
  shopName: string;
  date: string;
  startTime: string;
  endTime: string;
  hourlyRate: number;
  location: string;
  description: string;
  requiredWorkers: number;
  status: ShiftStatus;
  applicantCount: number;
}

export interface Application {
  id: string;
  shiftId: string;
  workerId: string;
  workerName: string;
  workerPhone: string;
  status: ApplicationStatus;
  appliedAt: string;
}

export interface Session {
  currentShopId: string;
  currentWorkerId: string;
}

export interface BubanGoData {
  shops: Shop[];
  workers: Worker[];
  shifts: Shift[];
  applications: Application[];
  session: Session;
}

export interface CreateShiftInput {
  shopId: string;
  date: string;
  startTime: string;
  endTime: string;
  hourlyRate: number;
  location: string;
  description: string;
  requiredWorkers: number;
}
