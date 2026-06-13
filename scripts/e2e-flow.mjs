// BubanGo end-to-end acceptance test — runs the full 補班 closed loop against
// the real Supabase project using only the anon key + Supabase Auth + RLS.
//
//   node scripts/e2e-flow.mjs
//
// It mirrors the queries in src/lib/data/supabase-repository.ts and
// src/lib/auth/auth-service.ts, but drives TWO separate clients (a shop owner
// and a worker) so each carries its own auth.uid() — exactly how RLS sees them
// in the browser. No service_role key, no hardcoded ids.
//
// Side effects: creates 2 test auth users (+ profile/shop/worker/shift/
// application rows) tagged with a timestamp so you can find and delete them in
// the Supabase dashboard afterwards. It never prints secrets.

import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  .replace(/\/+$/, "")
  .replace(/\/(rest|auth|storage|realtime)\/v1$/i, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
if (!url || !anonKey) {
  console.log("❌ Missing Supabase env vars in .env.local");
  process.exit(1);
}

const stamp = Date.now();
const PASSWORD = "BubanGo-test-1234";
// Use a domain with MX records — GoTrue rejects example.com etc. as invalid.
const shopEmail = `bubango.test.shop.${stamp}@gmail.com`;
const workerEmail = `bubango.test.worker.${stamp}@gmail.com`;

let passed = 0;
let failed = 0;
function check(label, ok, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (ok) passed += 1;
  else failed += 1;
}

function newClient() {
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

async function main() {
  console.log(`\n🧪 BubanGo e2e — run ${stamp}\n`);

  // --- 1. New shop owner registers ---------------------------------------
  const shop = newClient();
  const shopSignUp = await shop.auth.signUp({
    email: shopEmail,
    password: PASSWORD,
    options: { data: { role: "shop_owner", display_name: "驗收茶飲店", phone: "0912-000-001" } },
  });
  if (shopSignUp.error) {
    check("1. 店家註冊 (signUp)", false, shopSignUp.error.message);
    return finish();
  }
  if (!shopSignUp.data.session) {
    console.log(
      "\n⚠️  店家 signUp 沒有回傳 session → 專案開啟了 Email 確認（Confirm email）。\n" +
        "   這支自動化腳本無法替使用者點確認信，因此無法跑完閉環。\n" +
        "   兩種驗收方式：\n" +
        "   (A) 保留確認 + 已安裝 0002 trigger → 改用瀏覽器流程驗收\n" +
        "       （測試時可在 Supabase → Authentication → Users 手動把使用者設為已確認）。\n" +
        "   (B) 想要一鍵自動全綠 → 暫時關閉 Confirm email 後重跑本腳本，再開回來。\n"
    );
    check("1. 店家註冊 (signUp 取得 session)", false, "email confirmation enabled");
    return finish();
  }
  const shopUserId = shopSignUp.data.user.id;
  check("1. 店家註冊 (signUp + session)", true, `uid=${shopUserId.slice(0, 8)}…`);

  // --- 2. Create shop profile + shop row ---------------------------------
  const shopProfile = await shop.from("profiles").upsert(
    { id: shopUserId, role: "shop_owner", display_name: "驗收茶飲店", phone: "0912-000-001" },
    { onConflict: "id", ignoreDuplicates: true }
  );
  if (shopProfile.error) return fail("2. 建立店家 profile", shopProfile.error);

  // Mirror auth-service ensureShop: reuse the row the 0002 trigger may have
  // created from sign-up metadata; only insert if none exists (idempotent).
  let shopId;
  const existingShop = await shop.from("shops").select("id").eq("owner_id", shopUserId).limit(1).maybeSingle();
  if (existingShop.error) return fail("2. 讀取店家資料 (RLS)", existingShop.error);
  check("   0002 trigger 已自動建立 shop", !!existingShop.data, existingShop.data ? "trigger" : "fallback: client insert");
  if (existingShop.data) {
    shopId = existingShop.data.id;
  } else {
    const shopInsert = await shop
      .from("shops")
      .insert({ owner_id: shopUserId, name: "驗收茶飲店", address: "台北市測試路 1 號" })
      .select("id")
      .single();
    if (shopInsert.error) return fail("2. 建立店家資料 (shops insert, RLS)", shopInsert.error);
    shopId = shopInsert.data.id;
  }
  check("2. 建立店家資料", true, `shopId=${shopId.slice(0, 8)}…`);

  // --- 3. Shop publishes a shift -----------------------------------------
  const shiftInsert = await shop
    .from("shifts")
    .insert({
      shop_id: shopId,
      title: "台北市測試路 1 號", // location stored in title (MVP)
      date: "2026-07-01",
      start_time: "14:00",
      end_time: "17:00",
      hourly_wage: 200,
      required_workers: 1,
      description: "驗收用班次：點單、備料",
      status: "open",
      applicant_count: 0,
    })
    .select("*")
    .single();
  if (shiftInsert.error) return fail("3. 發布缺班 (shifts insert, RLS)", shiftInsert.error);
  const shiftId = shiftInsert.data.id;
  const namingOk =
    shiftInsert.data.required_workers === 1 && shiftInsert.data.hourly_wage === 200;
  check("3. 店家發布缺班", true, `shiftId=${shiftId.slice(0, 8)}…`);
  check("   命名轉換 required_workers / hourly_wage 寫入正確", namingOk);

  // --- 4. New worker registers -------------------------------------------
  const worker = newClient();
  const workerSignUp = await worker.auth.signUp({
    email: workerEmail,
    password: PASSWORD,
    options: { data: { role: "worker", display_name: "驗收打工者", phone: "0987-000-002" } },
  });
  if (workerSignUp.error) return fail("4. 打工者註冊 (signUp)", workerSignUp.error);
  if (!workerSignUp.data.session) {
    check("4. 打工者註冊 (signUp 取得 session)", false, "email confirmation enabled");
    return finish();
  }
  const workerUserId = workerSignUp.data.user.id;
  check("4. 打工者註冊", true, `uid=${workerUserId.slice(0, 8)}…`);

  // --- 5. Create worker profile ------------------------------------------
  const workerProfile = await worker.from("profiles").upsert(
    { id: workerUserId, role: "worker", display_name: "驗收打工者", phone: "0987-000-002" },
    { onConflict: "id", ignoreDuplicates: true }
  );
  if (workerProfile.error) return fail("5. 建立 worker profile", workerProfile.error);

  // Mirror auth-service ensureWorker: reuse the 0002 trigger row if present.
  let workerId;
  const existingWorker = await worker.from("workers").select("id").eq("user_id", workerUserId).limit(1).maybeSingle();
  if (existingWorker.error) return fail("5. 讀取 worker 資料 (RLS)", existingWorker.error);
  check("   0002 trigger 已自動建立 worker", !!existingWorker.data, existingWorker.data ? "trigger" : "fallback: client insert");
  if (existingWorker.data) {
    workerId = existingWorker.data.id;
  } else {
    const workerInsert = await worker
      .from("workers")
      .insert({ user_id: workerUserId, name: "驗收打工者", phone: "0987-000-002" })
      .select("id")
      .single();
    if (workerInsert.error) return fail("5. 建立 worker (workers insert, RLS)", workerInsert.error);
    workerId = workerInsert.data.id;
  }
  check("5. 建立 worker profile", true, `workerId=${workerId.slice(0, 8)}…`);

  // --- 6. Worker browses open shifts -------------------------------------
  const browse = await worker.from("shifts").select("id, status").eq("status", "open");
  if (browse.error) return fail("6. 打工者瀏覽缺班", browse.error);
  const sees = browse.data.some((s) => s.id === shiftId);
  check("6. 打工者瀏覽缺班 (看得到 open 缺班)", sees, `open 缺班 ${browse.data.length} 筆`);

  // --- 7. Worker applies --------------------------------------------------
  const apply = await worker
    .from("applications")
    .insert({ shift_id: shiftId, worker_id: workerId, status: "pending" })
    .select("id, status")
    .single();
  if (apply.error) return fail("7. 打工者申請缺班 (applications insert, RLS)", apply.error);
  const applicationId = apply.data.id;
  check("7. 打工者申請缺班", apply.data.status === "pending", `applicationId=${applicationId.slice(0, 8)}…`);

  // 7b. applicant_count trigger
  const afterApply = await shop.from("shifts").select("applicant_count").eq("id", shiftId).single();
  const countOk = !afterApply.error && afterApply.data.applicant_count === 1;
  check(
    "   applicant_count trigger 已 +1",
    countOk,
    afterApply.error ? afterApply.error.message : `applicant_count=${afterApply.data.applicant_count}（0 表示尚未套用 0001 migration）`
  );

  // 7c. RLS: worker must NOT be able to update the shift row
  const workerUpdateShift = await worker.from("shifts").update({ status: "cancelled" }).eq("id", shiftId).select("id");
  const blocked = !workerUpdateShift.error && (workerUpdateShift.data?.length ?? 0) === 0;
  check("   RLS：打工者無法竄改 shifts（0 rows updated）", blocked);

  // --- 8. Shop sees the applicant ----------------------------------------
  const shopApps = await shop.from("applications").select("id, worker_id, status").eq("shift_id", shiftId);
  if (shopApps.error) return fail("8. 店家看到申請者", shopApps.error);
  const shopSeesApp = shopApps.data.some((a) => a.id === applicationId);
  check("8. 店家看到申請者 (RLS：店主可讀自家缺班的申請)", shopSeesApp, `${shopApps.data.length} 筆申請`);

  // --- 9. Shop accepts ----------------------------------------------------
  const accept = await shop.from("applications").update({ status: "accepted" }).eq("id", applicationId).select("id, status").single();
  if (accept.error) return fail("9. 店家接受申請 (RLS：店主 update)", accept.error);
  // recompute shift status (required_workers = 1, accepted = 1 → matched)
  const acceptedCount = await shop
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("shift_id", shiftId)
    .eq("status", "accepted");
  if (acceptedCount.count >= 1) {
    const toMatched = await shop.from("shifts").update({ status: "matched" }).eq("id", shiftId).select("status").single();
    if (toMatched.error) return fail("9. 更新缺班為 matched", toMatched.error);
  }
  check("9. 店家接受申請 → 缺班 matched", accept.data.status === "accepted");

  // --- 10. Worker sees acceptance ----------------------------------------
  const myApps = await worker.from("applications").select("id, status").eq("worker_id", workerId);
  if (myApps.error) return fail("10. 打工者看到已錄取", myApps.error);
  const accepted = myApps.data.find((a) => a.id === applicationId);
  check("10. 打工者看到已錄取 (RLS：worker 讀自己的申請)", accepted?.status === "accepted");

  // --- 11. Matched shift no longer in open list --------------------------
  const browse2 = await worker.from("shifts").select("id").eq("status", "open");
  if (browse2.error) return fail("11. 已媒合缺班不再出現", browse2.error);
  const goneFromOpen = !browse2.data.some((s) => s.id === shiftId);
  check("11. 已媒合缺班不再出現在 open 缺班列表", goneFromOpen);

  finish();
}

function fail(label, error) {
  check(label, false, `${error.code ?? ""} ${error.message}`.trim());
  return finish();
}

function finish() {
  console.log(`\n———\n結果：${passed} passed, ${failed} failed`);
  console.log(`🧹 測試帳號（可在 Supabase Dashboard → Authentication 刪除）：\n   ${shopEmail}\n   ${workerEmail}`);
  process.exitCode = failed === 0 ? 0 : 2;
}

main().catch((e) => {
  console.error("\n💥 未預期錯誤：", e.message);
  process.exitCode = 1;
});
