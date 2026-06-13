import { getBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { UserRole } from "@/types";

/**
 * Auth flows for BubanGo (register / login / logout) on top of Supabase Auth.
 *
 * Onboarding strategy (MVP): after a sign-up that returns a session, we create
 * the profile and the role-specific row (shop / worker) directly from the
 * client. Every insert goes through RLS (`auth.uid()` checks), so no privileged
 * key is involved. Creation is idempotent, so it stays correct even if a DB
 * trigger also creates the profile.
 *
 * If the project has email confirmation enabled, sign-up returns no session;
 * we surface `status: "confirm_email"` and the rows are created on first login.
 */

export type RegisterResult =
  | { status: "ready"; role: UserRole }
  | { status: "confirm_email"; role: UserRole };

export interface ShopRegisterInput {
  email: string;
  password: string;
  storeName: string;
  phone: string;
  address: string;
  description?: string;
}

export interface WorkerRegisterInput {
  email: string;
  password: string;
  name: string;
  phone: string;
  experience?: string;
}

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "帳號或密碼錯誤";
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "此 Email 已經註冊過了，請直接登入";
  }
  if (m.includes("password")) return "密碼不符合規則（至少 6 個字元）";
  if (m.includes("rate limit")) return "操作太頻繁，請稍後再試";
  if (m.includes("email")) return "Email 格式不正確或無法使用";
  return message;
}

export async function registerShopOwner(
  input: ShopRegisterInput
): Promise<RegisterResult> {
  const supabase = getBrowserSupabaseClient();

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      // Metadata is consumed by the optional handle_new_user DB trigger so
      // onboarding still completes when email confirmation is enabled (no
      // client session at sign-up). Harmless when the trigger isn't installed.
      data: {
        role: "shop_owner",
        display_name: input.storeName,
        phone: input.phone,
        address: input.address,
        description: input.description ?? "",
      },
    },
  });

  if (error) throw new Error(translateAuthError(error.message));
  if (!data.user) throw new Error("註冊失敗，請稍後再試");
  if (!data.session) return { status: "confirm_email", role: "shop" };

  await ensureProfile(data.user.id, "shop_owner", input.storeName, input.phone);
  await ensureShop(data.user.id, {
    name: input.storeName,
    address: input.address,
    description: input.description,
  });

  return { status: "ready", role: "shop" };
}

export async function registerWorker(
  input: WorkerRegisterInput
): Promise<RegisterResult> {
  const supabase = getBrowserSupabaseClient();

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      // See registerShopOwner — consumed by the optional handle_new_user trigger.
      data: {
        role: "worker",
        display_name: input.name,
        phone: input.phone,
        experience: input.experience ?? "",
      },
    },
  });

  if (error) throw new Error(translateAuthError(error.message));
  if (!data.user) throw new Error("註冊失敗，請稍後再試");
  if (!data.session) return { status: "confirm_email", role: "worker" };

  await ensureProfile(data.user.id, "worker", input.name, input.phone);
  await ensureWorker(data.user.id, {
    name: input.name,
    phone: input.phone,
    experience: input.experience,
  });

  return { status: "ready", role: "worker" };
}

export async function login(
  email: string,
  password: string
): Promise<{ role: UserRole | null; needsOnboarding: boolean }> {
  const supabase = getBrowserSupabaseClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw new Error(translateAuthError(error.message));
  if (!data.user) throw new Error("登入失敗，請稍後再試");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) throw new Error(`讀取個人資料失敗：${profileError.message}`);
  if (!profile) return { role: null, needsOnboarding: false };

  // Fallback detection: the user has a role but the 0002 trigger may not have
  // created their shop/worker row. If it's missing, route them to onboarding.
  if (profile.role === "shop_owner") {
    const { data: shop } = await supabase
      .from("shops")
      .select("id")
      .eq("owner_id", data.user.id)
      .limit(1)
      .maybeSingle();
    return { role: "shop", needsOnboarding: !shop };
  }

  const { data: worker } = await supabase
    .from("workers")
    .select("id")
    .eq("user_id", data.user.id)
    .limit(1)
    .maybeSingle();
  return { role: "worker", needsOnboarding: !worker };
}

export async function logout(): Promise<void> {
  const supabase = getBrowserSupabaseClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(`登出失敗：${error.message}`);
}

// --- idempotent onboarding helpers ---------------------------------------

async function ensureProfile(
  id: string,
  role: "shop_owner" | "worker",
  displayName: string,
  phone: string
): Promise<void> {
  const supabase = getBrowserSupabaseClient();
  const { error } = await supabase
    .from("profiles")
    .upsert(
      { id, role, display_name: displayName, phone: phone || null },
      { onConflict: "id", ignoreDuplicates: true }
    );
  if (error) throw new Error(`建立個人資料失敗：${error.message}`);
}

async function ensureShop(
  ownerId: string,
  shop: { name: string; address: string; description?: string }
): Promise<void> {
  const supabase = getBrowserSupabaseClient();

  const { data: existing, error: readError } = await supabase
    .from("shops")
    .select("id")
    .eq("owner_id", ownerId)
    .limit(1)
    .maybeSingle();

  if (readError) throw new Error(`讀取店家資料失敗：${readError.message}`);
  if (existing) return;

  const { error } = await supabase.from("shops").insert({
    owner_id: ownerId,
    name: shop.name,
    address: shop.address,
    description: shop.description || null,
  });
  if (error) throw new Error(`建立店家資料失敗：${error.message}`);
}

async function ensureWorker(
  userId: string,
  worker: { name: string; phone: string; experience?: string }
): Promise<void> {
  const supabase = getBrowserSupabaseClient();

  const { data: existing, error: readError } = await supabase
    .from("workers")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (readError) throw new Error(`讀取打工者資料失敗：${readError.message}`);
  if (existing) return;

  const { error } = await supabase.from("workers").insert({
    user_id: userId,
    name: worker.name,
    phone: worker.phone || null,
    experience: worker.experience || null,
  });
  if (error) throw new Error(`建立打工者資料失敗：${error.message}`);
}
