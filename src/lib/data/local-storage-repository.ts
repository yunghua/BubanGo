import type {
  Application,
  BubanGoData,
  CreateShiftInput,
  Session,
  Shift,
} from "@/types";
import { createSeedData } from "@/lib/seed";
import type { BubanGoRepository } from "@/lib/data/bubango-repository";

export const STORAGE_KEYS = {
  data: "bubango_data",
  initialized: "bubango_initialized",
} as const;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function syncShiftApplicantCounts(
  shifts: Shift[],
  applications: Application[]
): Shift[] {
  return shifts.map((shift) => ({
    ...shift,
    applicantCount: applications.filter((app) => app.shiftId === shift.id).length,
  }));
}

/** Persisted shift may still carry legacy `headcount` from older localStorage data. */
type StoredShift = Shift & { headcount?: number };

function migrateShiftFields(shift: StoredShift): Shift {
  const { headcount: legacyHeadcount, requiredWorkers, ...rest } = shift;
  return {
    ...rest,
    requiredWorkers: requiredWorkers ?? legacyHeadcount ?? 1,
  };
}

function migrateData(data: BubanGoData): BubanGoData {
  return {
    ...data,
    shifts: data.shifts.map((shift) => migrateShiftFields(shift as StoredShift)),
  };
}

function syncShiftStatuses(
  shifts: Shift[],
  applications: Application[]
): Shift[] {
  return shifts.map((shift) => {
    if (shift.status === "completed" || shift.status === "cancelled") {
      return shift;
    }

    const acceptedCount = applications.filter(
      (app) => app.shiftId === shift.id && app.status === "accepted"
    ).length;

    if (acceptedCount >= shift.requiredWorkers) {
      return { ...shift, status: "matched" };
    }

    if (shift.status === "matched" && acceptedCount < shift.requiredWorkers) {
      return { ...shift, status: "open" };
    }

    return shift;
  });
}

function normalizeData(data: BubanGoData): BubanGoData {
  const migrated = migrateData(data);
  const shiftsWithStatus = syncShiftStatuses(
    migrated.shifts,
    migrated.applications
  );
  const shifts = syncShiftApplicantCounts(
    shiftsWithStatus,
    migrated.applications
  );
  return { ...migrated, shifts };
}

export class LocalStorageRepository implements BubanGoRepository {
  private readRaw(): BubanGoData | null {
    if (!isBrowser()) return null;
    const raw = localStorage.getItem(STORAGE_KEYS.data);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as BubanGoData;
    } catch {
      return null;
    }
  }

  private writeRaw(data: BubanGoData): void {
    if (!isBrowser()) return;
    localStorage.setItem(STORAGE_KEYS.data, JSON.stringify(data));
    localStorage.setItem(STORAGE_KEYS.initialized, "true");
  }

  private saveData(data: BubanGoData): BubanGoData {
    const normalized = normalizeData(data);
    this.writeRaw(normalized);
    return normalized;
  }

  private initStorage(): BubanGoData {
    if (!isBrowser()) {
      return createSeedData();
    }

    const existing = this.readRaw();
    if (existing) {
      const normalized = normalizeData(existing);
      this.writeRaw(normalized);
      return normalized;
    }

    const seed = createSeedData();
    this.writeRaw(seed);
    return seed;
  }

  private loadData(): BubanGoData {
    if (!isBrowser()) {
      return createSeedData();
    }
    return this.initStorage();
  }

  async getData(): Promise<BubanGoData> {
    return this.loadData();
  }

  async getShifts(): Promise<Shift[]> {
    return this.loadData().shifts;
  }

  async getShiftById(id: string): Promise<Shift | undefined> {
    return this.loadData().shifts.find((shift) => shift.id === id);
  }

  async getApplications(): Promise<Application[]> {
    return this.loadData().applications;
  }

  async getApplicationsByWorker(workerId: string): Promise<Application[]> {
    return this.loadData().applications.filter((app) => app.workerId === workerId);
  }

  async getApplicationsByShift(shiftId: string): Promise<Application[]> {
    return this.loadData().applications.filter((app) => app.shiftId === shiftId);
  }

  async getCurrentSession(): Promise<Session> {
    return this.loadData().session;
  }

  async createShift(input: CreateShiftInput): Promise<Shift> {
    const data = this.loadData();
    const shop = data.shops.find((s) => s.id === input.shopId);

    if (!shop) {
      throw new Error("找不到店家資料");
    }

    const newShift: Shift = {
      id: generateId("shift"),
      shopId: shop.id,
      shopName: shop.name,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      hourlyRate: input.hourlyRate,
      location: input.location,
      description: input.description,
      requiredWorkers: input.requiredWorkers,
      status: "open",
      applicantCount: 0,
    };

    this.saveData({
      ...data,
      shifts: [newShift, ...data.shifts],
    });

    return newShift;
  }

  async applyToShift(shiftId: string, workerId: string): Promise<Application> {
    const data = this.loadData();
    const shift = data.shifts.find((s) => s.id === shiftId);
    const worker = data.workers.find((w) => w.id === workerId);

    if (!shift) {
      throw new Error("找不到此缺班");
    }

    if (shift.status !== "open") {
      throw new Error("此缺班目前無法申請");
    }

    if (!worker) {
      throw new Error("找不到打工者資料");
    }

    const alreadyApplied = data.applications.some(
      (app) =>
        app.shiftId === shiftId &&
        app.workerId === workerId &&
        app.status !== "rejected"
    );

    if (alreadyApplied) {
      throw new Error("你已申請過此缺班");
    }

    const application: Application = {
      id: generateId("app"),
      shiftId,
      workerId,
      workerName: worker.name,
      workerPhone: worker.phone,
      status: "pending",
      appliedAt: new Date().toISOString(),
    };

    this.saveData({
      ...data,
      applications: [application, ...data.applications],
    });

    return application;
  }

  async acceptApplication(applicationId: string): Promise<void> {
    const data = this.loadData();
    const application = data.applications.find((app) => app.id === applicationId);

    if (!application) {
      throw new Error("找不到申請紀錄");
    }

    if (application.status !== "pending") {
      throw new Error("此申請已處理過");
    }

    const updatedApplications = data.applications.map((app) => {
      if (app.id === applicationId) {
        return { ...app, status: "accepted" as const };
      }
      return app;
    });

    this.saveData({ ...data, applications: updatedApplications });
  }

  async rejectApplication(applicationId: string): Promise<void> {
    const data = this.loadData();
    const application = data.applications.find((app) => app.id === applicationId);

    if (!application) {
      throw new Error("找不到申請紀錄");
    }

    if (application.status !== "pending") {
      throw new Error("此申請已處理過");
    }

    const updatedApplications = data.applications.map((app) => {
      if (app.id === applicationId) {
        return { ...app, status: "rejected" as const };
      }
      return app;
    });

    this.saveData({ ...data, applications: updatedApplications });
  }

  /** Dev / testing helper — clears persisted data and re-seeds. */
  reset(): BubanGoData {
    if (isBrowser()) {
      localStorage.removeItem(STORAGE_KEYS.data);
      localStorage.removeItem(STORAGE_KEYS.initialized);
    }
    return this.initStorage();
  }
}

export const localStorageRepository = new LocalStorageRepository();
