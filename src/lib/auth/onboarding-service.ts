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

export type OnboardingRole = "shop_owner" | "worker";

export interface CompleteOnboardingInput {
  role: OnboardingRole;
  displayName: string;
  phone: string;
  /** Required when role === "shop_owner" (shops.address is NOT NULL). */
  address?: string;
}

/**
 * First-time onboarding for users who arrive without a role (primarily LINE
 * Login users — the 0008 trigger no longer auto-provisions them). Creates the
 * profile (with the chosen role) BEFORE the shop/worker row, because the
 * shops/workers insert policies check `profiles.role`. Finally mirrors the role
 * into auth metadata so the DB-free middleware recognizes the user next request.
 *
 * Identity comes from `auth.uid()`; every write goes through RLS (own-row).
 */
export async function completeOnboarding(
  input: CompleteOnboardingInput
): Promise<void> {
  const supabase = getBrowserSupabaseClient();
  const userId = await requireUserId();

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      role: input.role,
      display_name: input.displayName,
      phone: input.phone || null,
    },
    { onConflict: "id" }
  );
  if (profileError) throw new Error(`建立個人資料失敗：${profileError.message}`);

  if (input.role === "shop_owner") {
    await ensureShopForCurrentUser({
      name: input.displayName,
      address: input.address ?? "",
      area: "",
      description: "",
    });
  } else {
    await ensureWorkerForCurrentUser({
      name: input.displayName,
      phone: input.phone,
      area: "",
      experience: "",
    });
  }

  // Mirror role into auth metadata for middleware. Fatal on failure so we never
  // leave a profile whose role the middleware can't see (avoids redirect churn).
  const { error: metaError } = await supabase.auth.updateUser({
    data: { role: input.role },
  });
  if (metaError) throw new Error(`完成設定失敗：${metaError.message}`);
}

/**
 * Best-effort prefill for the onboarding form from auth metadata (a LINE user's
 * display name often arrives via the OIDC `name` claim). Never throws.
 */
export async function getSuggestedProfile(): Promise<{
  displayName: string;
  phone: string;
}> {
  try {
    const supabase = getBrowserSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
    const pick = (k: string) =>
      typeof meta[k] === "string" ? (meta[k] as string) : "";
    return {
      displayName: pick("display_name") || pick("name") || pick("full_name"),
      phone: pick("phone"),
    };
  } catch {
    return { displayName: "", phone: "" };
  }
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
