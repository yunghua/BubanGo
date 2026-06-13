import type { Application, Shift, Shop, UserRole, Worker } from "@/types";
import type { Database, DbProfileRole } from "@/lib/supabase/types";

/**
 * Boundary mappers between Supabase rows (snake_case) and app types (camelCase).
 *
 * Canonical naming pairs:
 *   requiredWorkers ↔ required_workers
 *   hourlyRate      ↔ hourly_wage
 *   applicantCount  ↔ applicant_count
 *   shopId          ↔ shop_id
 *   workerId        ↔ worker_id
 *   shiftId         ↔ shift_id
 */

type ShopRow = Database["public"]["Tables"]["shops"]["Row"];
type WorkerRow = Database["public"]["Tables"]["workers"]["Row"];
type ShiftRow = Database["public"]["Tables"]["shifts"]["Row"];
type ApplicationRow = Database["public"]["Tables"]["applications"]["Row"];

// --- role -----------------------------------------------------------------

export function dbRoleToAppRole(role: DbProfileRole): UserRole {
  return role === "shop_owner" ? "shop" : "worker";
}

export function appRoleToDbRole(role: UserRole): DbProfileRole {
  return role === "shop" ? "shop_owner" : "worker";
}

// --- helpers --------------------------------------------------------------

/** Postgres `time` comes back as "HH:MM:SS"; the UI uses "HH:MM". */
function toShortTime(value: string): string {
  return value.length >= 5 ? value.slice(0, 5) : value;
}

/** workers.area is a single text column; Worker.areas is a string[]. */
function splitAreas(area: string | null): string[] {
  if (!area) return [];
  return area
    .split(/[、,，;；]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function joinAreas(areas: string[]): string | null {
  const joined = areas.map((a) => a.trim()).filter(Boolean).join("、");
  return joined.length > 0 ? joined : null;
}

// --- row → app type -------------------------------------------------------

export function mapShopRow(row: ShopRow, ownerPhone: string | null): Shop {
  return {
    id: row.id,
    userId: row.owner_id,
    name: row.name,
    address: row.address,
    // shops has no phone column; the owner's phone lives on their profile and
    // is only readable (RLS) by the owner themselves.
    phone: ownerPhone ?? "",
    description: row.description ?? undefined,
  };
}

export function mapWorkerRow(row: WorkerRow): Worker {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    phone: row.phone ?? "",
    areas: splitAreas(row.area),
    experience: row.experience ?? "",
  };
}

export function mapShiftRow(row: ShiftRow, shopName: string): Shift {
  return {
    id: row.id,
    shopId: row.shop_id,
    shopName,
    date: row.date,
    startTime: toShortTime(row.start_time),
    endTime: toShortTime(row.end_time),
    hourlyRate: row.hourly_wage,
    // MVP: shifts has no dedicated location column — the `title` column stores
    // the location string (see docs/SUPABASE_SCHEMA.md).
    location: row.title,
    description: row.description ?? "",
    requiredWorkers: row.required_workers,
    status: row.status,
    applicantCount: row.applicant_count,
  };
}

export function mapApplicationRow(
  row: ApplicationRow,
  worker: Pick<WorkerRow, "name" | "phone"> | null
): Application {
  // DB allows a 'cancelled' status the app UI doesn't model — fold into rejected.
  const status: Application["status"] =
    row.status === "accepted"
      ? "accepted"
      : row.status === "pending"
        ? "pending"
        : "rejected";

  return {
    id: row.id,
    shiftId: row.shift_id,
    workerId: row.worker_id,
    workerName: worker?.name ?? "",
    workerPhone: worker?.phone ?? "",
    status,
    appliedAt: row.created_at,
  };
}
