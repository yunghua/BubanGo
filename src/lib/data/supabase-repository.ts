import type {
  Application,
  BubanGoData,
  CreateShiftInput,
  Session,
  Shift,
} from "@/types";
import type { BubanGoRepository } from "@/lib/data/bubango-repository";

/**
 * Future Supabase-backed repository.
 *
 * Table mapping (planned):
 * - getData / getCurrentSession → profiles + session from Supabase Auth
 * - getShifts / getShiftById / createShift → shifts
 * - getApplications / getApplicationsByWorker / getApplicationsByShift → applications
 * - applyToShift → INSERT into applications
 * - acceptApplication / rejectApplication → UPDATE applications.status
 * - shops → shops (joined on shifts.shop_id)
 * - workers → workers (joined on applications.worker_id)
 */
export class SupabaseRepository implements BubanGoRepository {
  getData(): BubanGoData {
    // TODO: fetch shops, workers, shifts, applications from Supabase
    throw new Error("Supabase repository not implemented yet");
  }

  getShifts(): Shift[] {
    // TODO: SELECT * FROM shifts WHERE status = 'open' (or all for store dashboard)
    throw new Error("Supabase repository not implemented yet");
  }

  getShiftById(id: string): Shift | undefined {
    // TODO: SELECT * FROM shifts WHERE id = $id
    void id;
    throw new Error("Supabase repository not implemented yet");
  }

  createShift(input: CreateShiftInput): Shift {
    // TODO: INSERT INTO shifts (shop_id, date, start_time, end_time, ...)
    void input;
    throw new Error("Supabase repository not implemented yet");
  }

  getApplications(): Application[] {
    // TODO: SELECT * FROM applications
    throw new Error("Supabase repository not implemented yet");
  }

  getApplicationsByWorker(workerId: string): Application[] {
    // TODO: SELECT * FROM applications WHERE worker_id = $workerId
    void workerId;
    throw new Error("Supabase repository not implemented yet");
  }

  getApplicationsByShift(shiftId: string): Application[] {
    // TODO: SELECT * FROM applications WHERE shift_id = $shiftId
    void shiftId;
    throw new Error("Supabase repository not implemented yet");
  }

  applyToShift(shiftId: string, workerId: string): Application {
    // TODO: INSERT INTO applications (shift_id, worker_id, status = 'pending')
    void shiftId;
    void workerId;
    throw new Error("Supabase repository not implemented yet");
  }

  acceptApplication(applicationId: string): void {
    // TODO: UPDATE applications SET status = 'accepted' WHERE id = $applicationId
    // TODO: recompute shift status → matched when accepted count >= required_workers
    void applicationId;
    throw new Error("Supabase repository not implemented yet");
  }

  rejectApplication(applicationId: string): void {
    // TODO: UPDATE applications SET status = 'rejected' WHERE id = $applicationId
    void applicationId;
    throw new Error("Supabase repository not implemented yet");
  }

  getCurrentSession(): Session {
    // TODO: resolve current user from profiles + Supabase Auth → shop_id or worker_id
    throw new Error("Supabase repository not implemented yet");
  }
}

export const supabaseRepository = new SupabaseRepository();
