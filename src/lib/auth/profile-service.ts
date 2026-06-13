import { getBrowserSupabaseClient } from "@/lib/supabase/browser";
import { joinAreas } from "@/lib/data/mappers";

/**
 * Profile edit flows for the shop settings / worker profile pages.
 * All updates run under RLS (owner / self update policies).
 */

export interface ShopProfileInput {
  name: string;
  address: string;
  description: string;
  phone: string;
}

export interface WorkerProfileInput {
  name: string;
  phone: string;
  /** Free-text "可工作地區" — split on punctuation into workers.area. */
  areasText: string;
  experience: string;
}

export async function updateShopProfile(
  shopId: string,
  ownerId: string,
  input: ShopProfileInput
): Promise<void> {
  const supabase = getBrowserSupabaseClient();

  const { error: shopError } = await supabase
    .from("shops")
    .update({
      name: input.name,
      address: input.address,
      description: input.description || null,
    })
    .eq("id", shopId);
  if (shopError) throw new Error(`儲存店家資料失敗：${shopError.message}`);

  // Phone lives on the owner's profile (shops has no phone column).
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ phone: input.phone || null })
    .eq("id", ownerId);
  if (profileError) throw new Error(`儲存聯絡電話失敗：${profileError.message}`);
}

export async function updateWorkerProfile(
  workerId: string,
  input: WorkerProfileInput
): Promise<void> {
  const supabase = getBrowserSupabaseClient();

  const { error } = await supabase
    .from("workers")
    .update({
      name: input.name,
      phone: input.phone || null,
      area: joinAreas(
        input.areasText
          .split(/[、,，;；\n]/)
          .map((s) => s.trim())
          .filter(Boolean)
      ),
      experience: input.experience || null,
    })
    .eq("id", workerId);

  if (error) throw new Error(`儲存個人資料失敗：${error.message}`);
}
