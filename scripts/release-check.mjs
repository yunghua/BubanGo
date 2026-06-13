// BubanGo release readiness check — SAFE checks only.
//
//   node scripts/release-check.mjs
//
// Verifies the public env vars are present and shaped correctly, then runs the
// read-only schema check, then prints the remaining checklist commands. It does
// NOT use a service_role key, NOT delete any data, NOT create test users, and
// NOT print any secret values (only booleans / shapes).

import { spawnSync } from "node:child_process";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

let problems = 0;
const ok = (label, pass, note = "") => {
  console.log(`${pass ? "✅" : "❌"} ${label}${note ? ` — ${note}` : ""}`);
  if (!pass) problems += 1;
};

console.log("🔎 BubanGo release check (safe, read-only)\n");

// --- env presence (no values printed) ----------------------------------
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
const backend = process.env.NEXT_PUBLIC_DATA_BACKEND?.trim() ?? "(unset → supabase)";

ok("NEXT_PUBLIC_SUPABASE_URL is set", rawUrl.length > 0);
ok("NEXT_PUBLIC_SUPABASE_ANON_KEY is set", anonKey.length > 0);
console.log(`ℹ️  NEXT_PUBLIC_DATA_BACKEND = ${backend}`);

// --- url shape (root, not /rest/v1; no secret printed) ------------------
if (rawUrl) {
  try {
    const u = new URL(rawUrl);
    const cleanPath = u.pathname === "" || u.pathname === "/";
    ok(
      "Supabase URL is the project root (no /rest/v1 path)",
      cleanPath,
      cleanPath ? "" : `pathname is "${u.pathname}" — should be empty`
    );
    ok("Supabase URL uses https", u.protocol === "https:");
  } catch {
    ok("Supabase URL parses", false);
  }
}

// --- anon key looks like a JWT, not a service_role hint -----------------
if (anonKey) {
  // We only check the *role* claim of the (public) anon JWT to catch an
  // accidental service_role paste. We never print the key.
  let role = "(unreadable)";
  try {
    const payload = JSON.parse(Buffer.from(anonKey.split(".")[1] ?? "", "base64").toString());
    role = payload.role ?? "(none)";
  } catch {
    /* new-style publishable keys aren't JWTs — skip */
  }
  ok(
    "Key is NOT a service_role key",
    role !== "service_role",
    role === "service_role" ? "⚠️ this looks like a service_role key — use the anon key" : `role=${role}`
  );
}

// --- schema check (read-only; spawns check-supabase) --------------------
console.log("\n— schema —");
const schema = spawnSync(process.execPath, ["scripts/check-supabase.mjs"], {
  stdio: "inherit",
});
if (schema.status !== 0) problems += 1;

// --- remaining checklist (commands to run manually) ---------------------
console.log("\n— run these to finish the checklist —");
console.log("  npm run build");
console.log("  node scripts/e2e-flow.mjs            # Email Confirmation OFF → full loop");
console.log("  node scripts/e2e-flow.mjs --unique   # + 0005 unique-constraint checks");
console.log("  node scripts/check-duplicates.mjs    # expect 無重複");
console.log("\n— manual (Dashboard, no service_role) —");
console.log("  • Authentication → Users: delete bubango.test* / bubango.dupcheck* (cascades). Do NOT delete real users.");
console.log("  • Confirm RLS enabled on profiles/shops/workers/shifts/applications.");
console.log("  • Decide & record the Email Confirmation setting (see docs/RELEASE_CHECKLIST.md).");

console.log(
  problems === 0
    ? "\n✅ Safe checks passed."
    : `\n❌ ${problems} issue(s) above — fix before tagging.`
);
process.exitCode = problems === 0 ? 0 : 1;
