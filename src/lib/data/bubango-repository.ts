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
 *
 * All methods are async: the localStorage implementation resolves immediately,
 * the Supabase implementation performs network requests.
 */
export interface BubanGoRepository {
  getData(): Promise<BubanGoData>;
  getShifts(): Promise<Shift[]>;
  getShiftById(id: string): Promise<Shift | undefined>;
  createShift(input: CreateShiftInput): Promise<Shift>;
  getApplications(): Promise<Application[]>;
  getApplicationsByWorker(workerId: string): Promise<Application[]>;
  getApplicationsByShift(shiftId: string): Promise<Application[]>;
  applyToShift(shiftId: string, workerId: string): Promise<Application>;
  acceptApplication(applicationId: string): Promise<void>;
  rejectApplication(applicationId: string): Promise<void>;
  getCurrentSession(): Promise<Session>;
}
