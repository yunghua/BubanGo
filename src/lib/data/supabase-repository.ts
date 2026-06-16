import type {
  Application,
  BubanGoData,
  CreateShiftInput,
  Session,
  Shift,
} from "@/types";
import type { BubanGoRepository } from "@/lib/data/bubango-repository";
import type { Database } from "@/lib/supabase/types";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";
import {
  mapApplicationRow,
  mapShiftRow,
  mapShopRow,
  mapWorkerRow,
} from "@/lib/data/mappers";

type WorkerRow = Database["public"]["Tables"]["workers"]["Row"];

const EMPTY_SESSION: Session = {
  userId: "",
  role: null,
  currentShopId: "",
  currentWorkerId: "",
};

/** Map accept_application RPC error codes (raised as messages) to UI text. */
function translateAcceptError(message: string): string {
  const m = message ?? "";
  if (m.includes("application_not_found")) return "找不到申請紀錄";
  if (m.includes("not_shift_owner")) return "你沒有權限處理這個申請";
  if (m.includes("shift_not_open")) return "此缺班目前無法接受申請";
  if (m.includes("shift_already_full")) return "此缺班已額滿，無法再接受";
  if (m.includes("application_not_pending")) return "此申請已處理過";
  return `操作失敗：${m}`;
}

/** Map apply_to_shift RPC error codes (raised as messages) to UI text. */
function translateApplyError(message: string): string {
  const m = message ?? "";
  if (m.includes("not_authenticated")) return "請先登入後再申請";
  if (m.includes("not_worker")) return "只有打工者帳號可以申請缺班";
  if (m.includes("worker_not_found")) return "找不到打工者資料，請先完成註冊";
  if (m.includes("shift_not_found")) return "找不到此缺班";
  if (m.includes("shift_not_open")) return "此缺班目前無法申請";
  if (m.includes("shift_already_full")) return "此缺班已額滿";
  if (m.includes("already_applied")) return "你已申請過此缺班";
  return `申請失敗：${m}`;
}

/** Map reject_application RPC error codes (raised as messages) to UI text. */
function translateRejectError(message: string): string {
  const m = message ?? "";
  if (m.includes("not_authenticated")) return "請先登入";
  if (m.includes("application_not_found")) return "找不到申請紀錄";
  if (m.includes("not_shift_owner")) return "你沒有權限處理這個申請";
  if (m.includes("shift_not_editable")) return "此缺班已結束，無法變更";
  if (m.includes("application_not_rejectable")) return "此申請已處理過";
  return `操作失敗：${m}`;
}

/**
 * Supabase-backed implementation of {@link BubanGoRepository}.
 *
 * Runs in the browser via the cookie-based client from `@supabase/ssr`.
 * Every table access goes through Row Level Security — the client only ever
 * uses the anon key, so the database policies are the real authorization layer.
 *
 * Naming conversions (snake_case ↔ camelCase) live in `mappers.ts`. Joins are
 * done in JS (fetch + Map) rather than embedded selects to keep the hand-written
 * Database types simple and the query results strongly typed.
 */
export class SupabaseRepository implements BubanGoRepository {
  private get client() {
    return getBrowserSupabaseClient();
  }

  // --- session ------------------------------------------------------------

  async getCurrentSession(): Promise<Session> {
    const supabase = this.client;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return EMPTY_SESSION;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      throw new Error(`讀取個人資料失敗：${profileError.message}`);
    }

    // Authenticated but onboarding not finished (no profile row yet).
    if (!profile) {
      return { userId: user.id, role: null, currentShopId: "", currentWorkerId: "" };
    }

    if (profile.role === "shop_owner") {
      const { data: shop, error } = await supabase
        .from("shops")
        .select("id")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new Error(`讀取店家資料失敗：${error.message}`);
      }

      return {
        userId: user.id,
        role: "shop",
        currentShopId: shop?.id ?? "",
        currentWorkerId: "",
      };
    }

    const { data: worker, error } = await supabase
      .from("workers")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`讀取打工者資料失敗：${error.message}`);
    }

    return {
      userId: user.id,
      role: "worker",
      currentShopId: "",
      currentWorkerId: worker?.id ?? "",
    };
  }

  // --- full snapshot ------------------------------------------------------

  async getData(): Promise<BubanGoData> {
    const supabase = this.client;
    const session = await this.getCurrentSession();

    if (!session.userId) {
      return { shops: [], workers: [], shifts: [], applications: [], session };
    }

    const [shopsRes, shiftsRes, appsRes, profileRes] = await Promise.all([
      supabase.from("shops").select("*"),
      supabase.from("shifts").select("*").order("date", { ascending: true }),
      supabase
        .from("applications")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("phone").eq("id", session.userId).maybeSingle(),
    ]);

    if (shopsRes.error) throw new Error(`讀取店家失敗：${shopsRes.error.message}`);
    if (shiftsRes.error) throw new Error(`讀取缺班失敗：${shiftsRes.error.message}`);
    if (appsRes.error) throw new Error(`讀取申請失敗：${appsRes.error.message}`);

    const ownPhone = profileRes.data?.phone ?? null;
    const shopNameById = new Map(shopsRes.data.map((s) => [s.id, s.name]));

    const shops = shopsRes.data.map((s) =>
      mapShopRow(s, s.owner_id === session.userId ? ownPhone : null)
    );
    const shifts = shiftsRes.data.map((s) =>
      mapShiftRow(s, shopNameById.get(s.shop_id) ?? "")
    );

    // Workers referenced by visible applications (+ the current worker) so the
    // application cards and the worker profile page have names to render.
    const workerById = await this.fetchWorkerMap([
      ...appsRes.data.map((a) => a.worker_id),
      ...(session.currentWorkerId ? [session.currentWorkerId] : []),
    ]);

    const workers = Array.from(workerById.values()).map(mapWorkerRow);
    const applications = appsRes.data.map((a) =>
      mapApplicationRow(a, workerById.get(a.worker_id) ?? null)
    );

    return { shops, workers, shifts, applications, session };
  }

  // --- shifts -------------------------------------------------------------

  async getShifts(): Promise<Shift[]> {
    const supabase = this.client;
    const [shiftsRes, shopsRes] = await Promise.all([
      supabase.from("shifts").select("*").order("date", { ascending: true }),
      supabase.from("shops").select("id, name"),
    ]);

    if (shiftsRes.error) throw new Error(`讀取缺班失敗：${shiftsRes.error.message}`);
    if (shopsRes.error) throw new Error(`讀取店家失敗：${shopsRes.error.message}`);

    const shopNameById = new Map(shopsRes.data.map((s) => [s.id, s.name]));
    return shiftsRes.data.map((s) => mapShiftRow(s, shopNameById.get(s.shop_id) ?? ""));
  }

  async getShiftById(id: string): Promise<Shift | undefined> {
    const supabase = this.client;
    const { data: shift, error } = await supabase
      .from("shifts")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`讀取缺班失敗：${error.message}`);
    if (!shift) return undefined;

    const { data: shop, error: shopError } = await supabase
      .from("shops")
      .select("name")
      .eq("id", shift.shop_id)
      .maybeSingle();

    if (shopError) throw new Error(`讀取店家失敗：${shopError.message}`);

    return mapShiftRow(shift, shop?.name ?? "");
  }

  async createShift(input: CreateShiftInput): Promise<Shift> {
    const supabase = this.client;

    const { data: row, error } = await supabase
      .from("shifts")
      .insert({
        shop_id: input.shopId,
        // MVP: the `title` column carries the location string.
        title: input.location,
        date: input.date,
        start_time: input.startTime,
        end_time: input.endTime,
        hourly_wage: input.hourlyRate,
        required_workers: input.requiredWorkers,
        description: input.description,
        status: "open",
        applicant_count: 0,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(`發布缺班失敗：${error.message}`);
    }

    const { data: shop } = await supabase
      .from("shops")
      .select("name")
      .eq("id", row.shop_id)
      .maybeSingle();

    return mapShiftRow(row, shop?.name ?? "");
  }

  // --- applications -------------------------------------------------------

  async getApplications(): Promise<Application[]> {
    const supabase = this.client;
    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(`讀取申請失敗：${error.message}`);
    return this.attachWorkers(data);
  }

  async getApplicationsByWorker(workerId: string): Promise<Application[]> {
    const supabase = this.client;
    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .eq("worker_id", workerId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(`讀取申請失敗：${error.message}`);
    return this.attachWorkers(data);
  }

  async getApplicationsByShift(shiftId: string): Promise<Application[]> {
    const supabase = this.client;
    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .eq("shift_id", shiftId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(`讀取申請失敗：${error.message}`);
    return this.attachWorkers(data);
  }

  /**
   * Apply to a shift atomically via the `apply_to_shift` RPC (migration 0004).
   * The function derives the worker from `auth.uid()`, locks the shift FOR
   * UPDATE, and enforces role/open/full/duplicate rules in one transaction.
   *
   * The `workerId` argument is intentionally ignored in Supabase mode — identity
   * comes from the auth session, never from the caller. It is kept only to match
   * the interface (the localStorage fallback still uses it).
   */
  async applyToShift(shiftId: string, workerId: string): Promise<Application> {
    void workerId; // Supabase derives the worker from auth.uid().
    const supabase = this.client;

    const { data, error } = await supabase.rpc("apply_to_shift", {
      p_shift_id: shiftId,
    });

    if (error) {
      throw new Error(translateApplyError(error.message));
    }
    if (!data) {
      throw new Error("申請失敗，請稍後再試");
    }

    // applicant_count is maintained by the DB trigger (migration 0001) on insert.
    const { data: worker } = await supabase
      .from("workers")
      .select("name, phone")
      .eq("id", data.worker_id)
      .maybeSingle();

    return {
      id: data.application_id,
      shiftId: data.shift_id,
      workerId: data.worker_id,
      workerName: worker?.name ?? "",
      workerPhone: worker?.phone ?? "",
      status: "pending",
      appliedAt: data.created_at,
    };
  }

  /**
   * Accept an application atomically via the `accept_application` RPC
   * (migration 0003). The function locks the shift row FOR UPDATE and does the
   * capacity check + status flip in one transaction, removing the race the old
   * read-then-write path had. RLS still applies (SECURITY INVOKER).
   */
  async acceptApplication(applicationId: string): Promise<void> {
    const { data, error } = await this.client.rpc("accept_application", {
      p_application_id: applicationId,
    });

    if (error) {
      throw new Error(translateAcceptError(error.message));
    }

    // When this accept fills the shift, decline the still-pending applicants so
    // they don't sit in 審核中 forever. Best-effort and non-fatal: the accept has
    // already committed, so a failed decline must never surface as an accept error.
    if (data?.shift_status === "matched" && data.shift_id) {
      await this.declineRemainingPending(data.shift_id, applicationId);
    }
  }

  /**
   * Reject every still-pending application on a now-matched shift (except the one
   * just accepted) via the existing reject_application RPC. Best-effort: runs the
   * rejects in parallel (Promise.allSettled) and logs any that fail — it never
   * throws, so it cannot roll back the accept that already succeeded.
   */
  private async declineRemainingPending(
    shiftId: string,
    acceptedApplicationId: string
  ): Promise<void> {
    const { data: pending, error } = await this.client
      .from("applications")
      .select("id")
      .eq("shift_id", shiftId)
      .eq("status", "pending");

    if (error || !pending) return;

    const toDecline = pending.filter((a) => a.id !== acceptedApplicationId);
    if (toDecline.length === 0) return;

    const results = await Promise.allSettled(
      toDecline.map((a) =>
        this.client
          .rpc("reject_application", { p_application_id: a.id })
          .then(({ error: rejectError }) => {
            if (rejectError) throw new Error(rejectError.message);
          })
      )
    );

    const failedIds: string[] = [];
    results.forEach((result, i) => {
      if (result.status === "rejected") failedIds.push(toDecline[i].id);
    });
    if (failedIds.length > 0) {
      console.error(
        "[acceptApplication] failed to auto-decline pending applications:",
        failedIds
      );
    }
  }

  /**
   * Reject an application atomically via the `reject_application` RPC
   * (migration 0006). Locks the shift row FOR UPDATE; if an accepted worker is
   * rejected and the shift drops below `required_workers`, the shift flips back
   * from `matched` to `open` in the same transaction. RLS still applies
   * (SECURITY INVOKER).
   */
  async rejectApplication(applicationId: string): Promise<void> {
    const { error } = await this.client.rpc("reject_application", {
      p_application_id: applicationId,
    });

    if (error) {
      throw new Error(translateRejectError(error.message));
    }
  }

  // --- internals ----------------------------------------------------------

  /** Fetch a worker_id → row map for the given ids (deduplicated). */
  private async fetchWorkerMap(ids: string[]): Promise<Map<string, WorkerRow>> {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (uniqueIds.length === 0) return new Map();

    const { data, error } = await this.client
      .from("workers")
      .select("*")
      .in("id", uniqueIds);

    if (error) throw new Error(`讀取打工者失敗：${error.message}`);
    return new Map((data ?? []).map((w) => [w.id, w]));
  }

  /** Join worker name/phone onto a list of application rows. */
  private async attachWorkers(
    rows: Database["public"]["Tables"]["applications"]["Row"][]
  ): Promise<Application[]> {
    const workerById = await this.fetchWorkerMap(rows.map((r) => r.worker_id));
    return rows.map((r) => mapApplicationRow(r, workerById.get(r.worker_id) ?? null));
  }
}

export const supabaseRepository = new SupabaseRepository();
