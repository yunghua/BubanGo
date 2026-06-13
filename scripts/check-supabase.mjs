// Supabase connectivity / schema self-check for BubanGo.
//
// Loads .env.local the same way Next.js does and verifies the expected tables
// exist. It NEVER prints env values or secrets — only table status lines.
//
//   node scripts/check-supabase.mjs
//
// Interpreting results (run with the anon key, no auth session):
//   ✅ exists        → table is present; RLS filters all rows for anon (expected)
//   ❌ NOT FOUND     → run supabase/schema.sql in the Supabase SQL Editor
//   ⚠️  unexpected   → some other error (printed without secrets)

import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  .replace(/\/+$/, "")
  .replace(/\/(rest|auth|storage|realtime)\/v1$/i, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!url || !anonKey) {
  console.log("❌ Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

console.log("🔌 Connecting to Supabase project (host hidden) ...");

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});

const tables = ["profiles", "shops", "workers", "shifts", "applications"];
let missing = 0;

for (const table of tables) {
  const { error } = await supabase
    .from(table)
    .select("*", { head: true, count: "exact" })
    .limit(1);

  if (!error) {
    console.log(`• ${table}: ✅ exists`);
  } else if (error.code === "42P01") {
    console.log(`• ${table}: ❌ NOT FOUND — run supabase/schema.sql`);
    missing += 1;
  } else {
    console.log(`• ${table}: ⚠️  ${error.code ?? ""} ${error.message}`.trim());
  }
}

console.log(
  missing === 0
    ? "\n✅ All tables present. Schema looks applied."
    : `\n❌ ${missing} table(s) missing. Open the Supabase SQL Editor and run supabase/schema.sql.`
);
process.exit(missing === 0 ? 0 : 2);
