-- BubanGo migration 0009 — harden application writes (close the raw-API bypass)
--
-- (Filed as 0009, not 0007: 0007_line_accounts.sql and 0008_line_login_primary.sql
--  already exist; this continues the sequence.)
--
-- Context — the app path is already safe:
--   The repository only ever writes `applications` through the row-locked RPCs
--   apply_to_shift / accept_application / reject_application. Each takes
--   SELECT ... FOR UPDATE on the shift and enforces open/capacity/duplicate rules
--   in one transaction, so concurrent applies/accepts cannot overbook.
--
-- The gap this closes — raw PostgREST bypass:
--   RLS WRITE policies on `applications` let an authenticated session write the
--   table DIRECTLY (anon key + a valid JWT), skipping the RPC guards:
--     * applications_insert_worker  → a worker could INSERT a pending row on a
--       matched/closed shift (skips apply_to_shift's shift_not_open check).
--     * applications_update_shop_owner → a shop owner could PATCH applications to
--       'accepted' beyond required_workers on their OWN shift (overbooking; skips
--       accept_application's FOR UPDATE lock + capacity check).
--
-- Fix (Option A) — funnel ALL application writes through the RPCs:
--   1) Drop the two direct WRITE policies on applications. SELECT policies are
--      kept, so the worker "my applications" and owner "applicants" reads are
--      unchanged. With no INSERT/UPDATE policy, direct PostgREST writes are denied
--      (RLS default-deny); there is no DELETE policy, so direct deletes were
--      already denied.
--   2) Convert accept_application / reject_application to SECURITY DEFINER so they
--      keep working after the owner UPDATE policy is removed (apply_to_shift is
--      already DEFINER). They still derive identity from auth.uid() (which returns
--      the CALLER's id inside a DEFINER function) and enforce explicit owner/role
--      checks (not_shift_owner / not_authenticated), and keep SET search_path =
--      public (already set in their definitions — the key DEFINER hardening).
--
-- Not done here: no service_role, no policy loosening, no broad table grants, no
-- schema/column changes, no edits to schema.sql comments. App UI is unaffected.
--
-- Idempotent: DROP POLICY IF EXISTS + ALTER FUNCTION + GRANT/REVOKE are repeatable.

-- 1) Remove direct write access to applications; reads stay as-is.
drop policy if exists "applications_insert_worker" on public.applications;
drop policy if exists "applications_update_shop_owner" on public.applications;

-- 2) accept/reject must no longer depend on the (now removed) owner UPDATE policy.
--    SECURITY DEFINER lets them perform their own writes; their internal auth.uid()
--    + owner checks remain the authorization layer. ALTER preserves each function's
--    existing body and its `SET search_path = public` (migrations 0003 / 0006).
alter function public.accept_application(uuid) security definer;
alter function public.reject_application(uuid) security definer;

-- Least privilege unchanged: only authenticated may execute (anon explicitly
-- revoked). Re-affirmed here so this migration is self-contained.
revoke all on function public.accept_application(uuid) from public, anon;
grant execute on function public.accept_application(uuid) to authenticated;
revoke all on function public.reject_application(uuid) from public, anon;
grant execute on function public.reject_application(uuid) to authenticated;
