import { getBrowserSupabaseClient } from "@/lib/supabase/browser";

/**
 * Onboarding fallback: create (or complete) the current user's shop / worker row
 * when the `0002_handle_new_user` trigger didn't (trigger missing/disabled, or
 * metadata incomplete). Identity always comes from `auth.uid()` — never trust
 * client-passed ids — and every write goes through RLS (own-row insert/update).
 *
 * Idempotent: if a row already exists it is UPDATED, never duplicated.
 */

async function requireUserId(): Promise<string> {
  const supabase = getBrowserSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("尚未登入，請重新登入");
  return user.id;
}

export interface ShopOnboardingInput {
  name: string;
  address: string;
  area: string;
  description: string;
}

export interface WorkerOnboardingInput {
  name: string;
  phone: string;
  area: string;
  experience: string;
}

export async function ensureShopForCurrentUser(
  input: ShopOnboardingInput
): Promise<void> {
  const supabase = getBrowserSupabaseClient();
  const ownerId = await requireUserId();

  const { data: existing, error: readError } = await supabase
    .from("shops")
    .select("id")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (readError) throw new Error(`讀取店家資料失敗：${readError.message}`);

  const fields = {
    name: input.name,
    address: input.address,
    area: input.area || null,
    description: input.description || null,
  };

  if (existing) {
    const { error } = await supabase.from("shops").update(fields).eq("id", existing.id);
    if (error) throw new Error(`更新店家資料失敗：${error.message}`);
    return;
  }

  const { error } = await supabase.from("shops").insert({ owner_id: ownerId, ...fields });
  if (!error) return;

  // 23505 = unique_violation on shops_owner_id_unique (migration 0005): another
  // request created the row first. Re-query it and complete it instead of crashing.
  if (error.code === "23505") {
    const { data: row } = await supabase
      .from("shops")
      .select("id")
      .eq("owner_id", ownerId)
      .limit(1)
      .maybeSingle();
    if (row) {
      const { error: updateError } = await supabase.from("shops").update(fields).eq("id", row.id);
      if (updateError) throw new Error(`更新店家資料失敗：${updateError.message}`);
      return;
    }
  }
  throw new Error(`建立店家資料失敗：${error.message}`);
}

export async function ensureWorkerForCurrentUser(
  input: WorkerOnboardingInput
): Promise<void> {
  const supabase = getBrowserSupabaseClient();
  const userId = await requireUserId();

  const { data: existing, error: readError } = await supabase
    .from("workers")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (readError) throw new Error(`讀取打工者資料失敗：${readError.message}`);

  const fields = {
    name: input.name,
    phone: input.phone || null,
    area: input.area || null,
    experience: input.experience || null,
  };

  if (existing) {
    const { error } = await supabase.from("workers").update(fields).eq("id", existing.id);
    if (error) throw new Error(`更新打工者資料失敗：${error.message}`);
    return;
  }

  const { error } = await supabase.from("workers").insert({ user_id: userId, ...fields });
  if (!error) return;

  // 23505 = unique_violation on workers_user_id_unique (migration 0005).
  if (error.code === "23505") {
    const { data: row } = await supabase
      .from("workers")
      .select("id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (row) {
      const { error: updateError } = await supabase.from("workers").update(fields).eq("id", row.id);
      if (updateError) throw new Error(`更新打工者資料失敗：${updateError.message}`);
      return;
    }
  }
  throw new Error(`建立打工者資料失敗：${error.message}`);
}
