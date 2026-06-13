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
const worker2Email = `bubango.test.worker2.${stamp}@gmail.com`;

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
    return confirmationEnabledExit("步驟 1 店家 signUp", [shopEmail]);
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
    return confirmationEnabledExit("步驟 4 打工者 signUp", [shopEmail, workerEmail]);
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

  // --- 7. Worker applies via apply_to_shift RPC (atomic, migration 0004) --
  const apply = await worker.rpc("apply_to_shift", { p_shift_id: shiftId });
  if (apply.error) {
    if (isMissingRpc(apply.error)) {
      check("7. apply_to_shift RPC", false, "找不到 RPC → 請先在 Supabase SQL Editor 執行 0004_apply_to_shift_rpc.sql");
      return finish();
    }
    return fail("7. 打工者申請缺班 (RPC apply_to_shift)", apply.error);
  }
  const applicationId = apply.data.application_id;
  check("7. 打工者申請缺班 (RPC apply_to_shift)", apply.data.status === "pending", `applicationId=${applicationId.slice(0, 8)}…`);

  // 7b. applicant_count trigger still bumps on the RPC's INSERT
  const afterApply = await shop.from("shifts").select("applicant_count").eq("id", shiftId).single();
  check(
    "   applicant_count trigger 已 +1（RPC insert 觸發）",
    !afterApply.error && afterApply.data.applicant_count === 1,
    afterApply.error ? afterApply.error.message : `applicant_count=${afterApply.data.applicant_count}`
  );

  // 7c. RLS: worker still cannot directly update the shift row
  const workerUpdateShift = await worker.from("shifts").update({ status: "cancelled" }).eq("id", shiftId).select("id");
  check("   RLS：打工者無法竄改 shifts（0 rows updated）", !workerUpdateShift.error && (workerUpdateShift.data?.length ?? 0) === 0);

  // 7d. shop owner cannot apply (not_worker)
  const ownerApply = await shop.rpc("apply_to_shift", { p_shift_id: shiftId });
  check(
    "   店主無法申請 (not_worker)",
    !!ownerApply.error && (ownerApply.error.message ?? "").includes("not_worker"),
    ownerApply.error?.message ?? "（不應成功）"
  );

  // 7e. duplicate apply by the same worker fails (already_applied)
  const dupApply = await worker.rpc("apply_to_shift", { p_shift_id: shiftId });
  check(
    "   重複申請被擋 (already_applied)",
    !!dupApply.error && (dupApply.error.message ?? "").includes("already_applied"),
    dupApply.error?.message ?? "（不應成功）"
  );

  // 7f. unauthenticated (anon) user cannot apply
  const anon = newClient();
  const anonApply = await anon.rpc("apply_to_shift", { p_shift_id: shiftId });
  check(
    "   未登入無法申請 (RPC 拒絕)",
    !!anonApply.error,
    anonApply.error ? `${anonApply.error.code ?? ""} ${anonApply.error.message ?? ""}`.trim() : "（不應成功）"
  );

  // --- 8. Shop sees the applicant ----------------------------------------
  const shopApps = await shop.from("applications").select("id, worker_id, status").eq("shift_id", shiftId);
  if (shopApps.error) return fail("8. 店家看到申請者", shopApps.error);
  const shopSeesApp = shopApps.data.some((a) => a.id === applicationId);
  check("8. 店家看到申請者 (RLS：店主可讀自家缺班的申請)", shopSeesApp, `${shopApps.data.length} 筆申請`);

  // --- 9. Shop accepts via accept_application RPC (atomic, migration 0003) -
  const accept = await shop.rpc("accept_application", { p_application_id: applicationId });
  if (accept.error) {
    if (isMissingRpc(accept.error)) {
      check("9. accept_application RPC", false, "找不到 RPC → 請先在 Supabase SQL Editor 執行 0003_accept_application_rpc.sql");
      return finish();
    }
    return fail("9. 店家接受申請 (RPC accept_application)", accept.error);
  }
  check("9. 店家接受申請 (RPC accept_application)", accept.data?.application_status === "accepted");
  check("   RPC 回傳 shift_status = matched (required=1)", accept.data?.shift_status === "matched", `accepted_count=${accept.data?.accepted_count}`);

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

  // ======================================================================
  // RPC race-protection tests (accept_application, migration 0003)
  // Separate shift with required_workers = 1 and two competing applicants.
  // ======================================================================

  // 12. second worker registers (0002 trigger creates the worker row)
  const worker2 = newClient();
  const w2 = await worker2.auth.signUp({
    email: worker2Email,
    password: PASSWORD,
    options: { data: { role: "worker", display_name: "驗收打工者2", phone: "0987-000-003" } },
  });
  if (w2.error) return fail("12. 第二位打工者註冊", w2.error);
  if (!w2.data.session) {
    return confirmationEnabledExit("步驟 12 第二位打工者 signUp", [shopEmail, workerEmail, worker2Email]);
  }
  let workerId2;
  const exW2 = await worker2.from("workers").select("id").eq("user_id", w2.data.user.id).limit(1).maybeSingle();
  if (exW2.error) return fail("12. 讀取 worker2", exW2.error);
  if (exW2.data) {
    workerId2 = exW2.data.id;
  } else {
    const ins = await worker2.from("workers").insert({ user_id: w2.data.user.id, name: "驗收打工者2", phone: "0987-000-003" }).select("id").single();
    if (ins.error) return fail("12. 建立 worker2", ins.error);
    workerId2 = ins.data.id;
  }
  check("12. 第二位打工者就緒", true, `workerId2=${workerId2.slice(0, 8)}…`);

  // 12b. applying to the already-matched shift1 fails (shift_not_open)
  const applyMatched = await worker2.rpc("apply_to_shift", { p_shift_id: shiftId });
  check(
    "   申請已 matched 的缺班被擋 (shift_not_open)",
    !!applyMatched.error && (applyMatched.error.message ?? "").includes("shift_not_open"),
    applyMatched.error?.message ?? "（不應成功）"
  );

  // 13. shop publishes a second shift (required_workers = 1)
  const shift2 = await shop
    .from("shifts")
    .insert({
      shop_id: shopId,
      title: "台北市測試路 2 號",
      date: "2026-07-02",
      start_time: "10:00",
      end_time: "13:00",
      hourly_wage: 210,
      required_workers: 1,
      description: "RPC 競態測試用班次",
      status: "open",
      applicant_count: 0,
    })
    .select("id")
    .single();
  if (shift2.error) return fail("13. 發布第二個缺班", shift2.error);
  const shiftId2 = shift2.data.id;
  check("13. 發布第二個缺班 (required_workers=1)", true, `shiftId2=${shiftId2.slice(0, 8)}…`);

  // 14. both workers apply to shift2 via the apply_to_shift RPC
  const a1 = await worker.rpc("apply_to_shift", { p_shift_id: shiftId2 });
  const a2 = await worker2.rpc("apply_to_shift", { p_shift_id: shiftId2 });
  if (a1.error) return fail("14. worker1 申請 shift2 (RPC)", a1.error);
  if (a2.error) return fail("14. worker2 申請 shift2 (RPC)", a2.error);
  const appId1 = a1.data.application_id;
  const appId2 = a2.data.application_id;
  check("14. 兩位打工者都用 RPC 申請 shift2", true, "2 筆 pending");

  // 15. non-owner cannot accept (a worker calls the RPC on their own application)
  const nonOwner = await worker.rpc("accept_application", { p_application_id: appId1 });
  check(
    "15. 非店主無法 accept (not_shift_owner)",
    !!nonOwner.error && (nonOwner.error.message ?? "").includes("not_shift_owner"),
    nonOwner.error?.message ?? "（不應成功）"
  );

  // 16. race: owner fires accept for BOTH pending apps at the same time
  const [r1, r2] = await Promise.all([
    shop.rpc("accept_application", { p_application_id: appId1 }),
    shop.rpc("accept_application", { p_application_id: appId2 }),
  ]);
  if (isMissingRpc(r1.error) || isMissingRpc(r2.error)) {
    check("16. 並發 accept", false, "找不到 RPC → 請先執行 0003_accept_application_rpc.sql");
    return finish();
  }
  const oks = [r1, r2].filter((r) => !r.error).length;
  const errs = [r1, r2].filter((r) => r.error).length;
  check("16. 並發 accept：恰好 1 成功 1 失敗 (FOR UPDATE 序列化)", oks === 1 && errs === 1, `成功 ${oks} / 失敗 ${errs}`);

  const accCount = await shop.from("applications").select("id", { count: "exact", head: true }).eq("shift_id", shiftId2).eq("status", "accepted");
  check("   shift2 最終 accepted 數 = 1（未超收 required_workers）", accCount.count === 1, `accepted=${accCount.count}`);
  const s2 = await shop.from("shifts").select("status").eq("id", shiftId2).single();
  check("   shift2 狀態 = matched", s2.data?.status === "matched");

  // 17. accepting the application that lost the race fails (shift now full)
  const pendingAppId = r1.error ? appId1 : appId2;
  const afterFull = await shop.rpc("accept_application", { p_application_id: pendingAppId });
  check(
    "17. 額滿後再 accept 仍失敗 (shift_not_open / shift_already_full)",
    !!afterFull.error,
    afterFull.error?.message ?? "（不應成功）"
  );

  // ======================================================================
  // Onboarding fallback idempotency (mirrors ensureShop/WorkerForCurrentUser).
  // We can't simulate a *missing* row (no RLS DELETE policy to remove the
  // trigger's row), but we can prove the "row already exists" path UPDATEs
  // instead of inserting — the key no-duplicate guarantee (items 7 & 8).
  // ======================================================================

  // 18. ensure-shop on an owner who already has a shop → update, not a 2nd row
  const exShop2 = await shop.from("shops").select("id").eq("owner_id", shopUserId).order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (exShop2.data) {
    await shop.from("shops").update({ area: "台北市大安區" }).eq("id", exShop2.data.id);
  } else {
    await shop.from("shops").insert({ owner_id: shopUserId, name: "驗收茶飲店", address: "台北市測試路 1 號" });
  }
  const shopCount = await shop.from("shops").select("id", { count: "exact", head: true }).eq("owner_id", shopUserId);
  check("18. onboarding 不會重複建立 shop（仍 1 筆）", shopCount.count === 1, `shops=${shopCount.count}`);

  // 19. same guarantee for the worker row
  const exWorker2 = await worker.from("workers").select("id").eq("user_id", workerUserId).order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (exWorker2.data) {
    await worker.from("workers").update({ area: "台北市大安區" }).eq("id", exWorker2.data.id);
  } else {
    await worker.from("workers").insert({ user_id: workerUserId, name: "驗收打工者", phone: "0987-000-002" });
  }
  const workerCount = await worker.from("workers").select("id", { count: "exact", head: true }).eq("user_id", workerUserId);
  check("19. onboarding 不會重複建立 worker（仍 1 筆）", workerCount.count === 1, `workers=${workerCount.count}`);

  // 20-21. DB-level unique constraint (migration 0005). Opt-in via --unique and
  // only meaningful AFTER 0005 is applied: a direct 2nd insert must be rejected
  // with 23505. (Skipped by default so a pre-0005 run can't create a duplicate.)
  if (process.argv.includes("--unique")) {
    const dupShop = await shop
      .from("shops")
      .insert({ owner_id: shopUserId, name: "dup", address: "dup" })
      .select("id");
    check(
      "20. 唯一限制：第二筆 shop 被擋 (23505)",
      dupShop.error?.code === "23505",
      dupShop.error?.code ?? "（竟然成功！0005 尚未套用？此筆需刪測試帳號清除）"
    );

    const dupWorker = await worker
      .from("workers")
      .insert({ user_id: workerUserId, name: "dup" })
      .select("id");
    check(
      "21. 唯一限制：第二筆 worker 被擋 (23505)",
      dupWorker.error?.code === "23505",
      dupWorker.error?.code ?? "（竟然成功！0005 尚未套用？）"
    );
  } else {
    console.log("ℹ️  （套用 0005 後可加 --unique 旗標，額外驗證唯一限制擋下第二筆 shop/worker）");
  }

  finish();
}

function isMissingRpc(error) {
  if (!error) return false;
  const msg = error.message ?? "";
  return error.code === "PGRST202" || msg.includes("Could not find the function") || msg.includes("does not exist");
}

function fail(label, error) {
  check(label, false, `${error.code ?? ""} ${error.message}`.trim());
  return finish();
}

function finish() {
  console.log(`\n———\n結果：${passed} passed, ${failed} failed`);
  console.log(`🧹 測試帳號（可在 Supabase Dashboard → Authentication 刪除，會連帶 cascade 清掉資料）：\n   ${shopEmail}\n   ${workerEmail}\n   ${worker2Email}`);
  process.exitCode = failed === 0 ? 0 : 2;
}

/**
 * Email Confirmation is ON → signUp returns no session, so the automated loop
 * can't run (we intentionally never touch an email inbox). This is a SKIP, not a
 * failure: it does not increment `failed` and exits 0.
 */
function confirmationEnabledExit(stageLabel, createdEmails) {
  console.log(
    `\n⏭️  e2e SKIPPED（這不是失敗）：在「${stageLabel}」偵測到 Email Confirmation 已開啟。\n` +
      `   signUp 不會立即回傳 session，本腳本刻意不依賴信箱、不會去點確認信，\n` +
      `   因此無法自動跑完整補班閉環。\n\n` +
      `   ▸ 正式機（confirmation ON）請改用手動 QA：docs/EMAIL_CONFIRMATION_QA.md（§4）\n` +
      `   ▸ 想要自動化全綠：暫時關閉 Confirm email → 重跑本腳本 → 再開回來（§3）\n`
  );
  console.log(`———\n結果：⏭️  SKIPPED（Email Confirmation enabled）— ${passed} passed, ${failed} failed, 0 errors`);
  if (createdEmails?.length) {
    console.log(
      `🧹 已建立的未確認測試帳號（可在 Authentication → Users 刪除）：\n   ${createdEmails.join("\n   ")}`
    );
  }
  process.exitCode = 0; // skip, not failure
}

main().catch((e) => {
  console.error("\n💥 未預期錯誤：", e.message);
  process.exitCode = 1;
});
