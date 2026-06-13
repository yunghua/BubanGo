// Detect duplicate shops-per-owner / workers-per-user BEFORE running migration
// 0005 (which will otherwise raise). Read-only against the data; the only write
// is one throwaway sign-up needed to get an authenticated read session (RLS lets
// any authenticated user SELECT all shops/workers). Prints NO secrets — only
// truncated uuids + counts.
//
//   node scripts/check-duplicates.mjs

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

const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
const stamp = Date.now();
const email = `bubango.dupcheck.${stamp}@gmail.com`;

const { data: su, error: suErr } = await supabase.auth.signUp({
  email,
  password: "BubanGo-test-1234",
  options: { data: { role: "worker", display_name: "dupcheck", phone: "0900-000-000" } },
});
if (suErr) {
  console.log("❌ 無法建立檢查用 session：", suErr.message);
  process.exit(1);
}
if (!su.session) {
  console.log(
    "⏭️  Email Confirmation 已開啟，拿不到讀取 session。\n" +
      "   直接在 SQL Editor 執行 0005——它會自我偵測重複並 raise 出相關 id。"
  );
  process.exit(0);
}

async function findDuplicates(table, col) {
  const { data, error } = await supabase.from(table).select(col);
  if (error) {
    console.log(`❌ 讀取 ${table} 失敗：${error.message}`);
    return null;
  }
  const counts = new Map();
  for (const row of data) {
    const key = row[col];
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n > 1);
}

let bad = 0;
function report(label, list) {
  if (!list) return;
  if (list.length === 0) {
    console.log(`✅ ${label}：無重複`);
    return;
  }
  bad += list.length;
  console.log(`❌ ${label}：${list.length} 組重複`);
  for (const [id, n] of list) console.log(`   ${String(id).slice(0, 8)}… ×${n}`);
}

report("shops(owner_id)", await findDuplicates("shops", "owner_id"));
report("workers(user_id)", await findDuplicates("workers", "user_id"));

console.log(
  bad === 0
    ? "\n✅ 沒有重複 → 0005_unique_shop_worker_owner.sql 可直接套用。"
    : "\n❌ 有重複 → 先到 Authentication → Users 刪除相關測試帳號（cascade 清資料、保留最舊），再套用 0005。"
);
console.log(`🧹 本檢查建立的臨時帳號（可刪）：${email}`);
process.exitCode = bad === 0 ? 0 : 2;
