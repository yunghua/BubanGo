import type {
  Application,
  BubanGoData,
  CreateShiftInput,
  Session,
  Shift,
} from "@/types";

/**
 * Data access contract for BubanGo.
 * UI and hooks depend on this interface only — swap implementations
 * (localStorage → Supabase) without touching page components.
 */
export interface BubanGoRepository {
  getData(): BubanGoData;
  getShifts(): Shift[];
  getShiftById(id: string): Shift | undefined;
  createShift(input: CreateShiftInput): Shift;
  getApplications(): Application[];
  getApplicationsByWorker(workerId: string): Application[];
  getApplicationsByShift(shiftId: string): Application[];
  applyToShift(shiftId: string, workerId: string): Application;
  acceptApplication(applicationId: string): void;
  rejectApplication(applicationId: string): void;
  getCurrentSession(): Session;
}
