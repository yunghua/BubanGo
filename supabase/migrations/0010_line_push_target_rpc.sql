-- BubanGo migration 0010 — get_line_push_target RPC (LINE push notifications)
--
-- Adds a SECURITY DEFINER lookup that lets the accept server route obtain the
-- accepted worker's verified LINE userId WITHOUT a service_role key and WITHOUT
-- loosening line_accounts RLS (which stays own-row only).
--
-- WHY THIS IS NEEDED
--   line_accounts SELECT is own-row only (auth.uid() = user_id; migration 0007).
--   Accepting is performed by the SHOP OWNER's session — not the worker — so the
--   owner cannot read the worker's line_accounts row under RLS, and service_role
--   is forbidden. This function reads it on the caller's behalf, but only after
--   proving the caller owns the shift AND the application is already accepted.
--
-- SECURITY MODEL (mirrors accept_application / migration 0009 hardening)
--   * SECURITY DEFINER + SET search_path = public — the key DEFINER hardening:
--     the body runs as the function owner (so it can read line_accounts), but the
--     fixed search_path blocks search_path injection.
--   * auth.uid() inside a DEFINER function is still the CALLER's id, so the owner
--     check below is meaningful (it does not become the function owner's id).
--   * Requires application.status = 'accepted', so an owner cannot fish arbitrary
--     line_user_ids for pending / other applications — only for a worker they
--     have actually accepted on their own shift.
--   * Returns ONLY the text line_user_id (NULL when the worker has no link). The
--     server route uses it solely to send a push and never returns it to the
--     browser. No write, no change to any existing table / policy / RPC.
--
-- Idempotent: create or replace + revoke/grant are repeatable.

create or replace function public.get_line_push_target(p_application_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner        uuid;
  v_app_status   text;
  v_line_user_id text;
begin
  -- Ownership + application status in one read (application → shift → shop).
  select sh.owner_id, a.status
    into v_owner, v_app_status
  from public.applications a
  join public.shifts s on s.id = a.shift_id
  join public.shops sh on sh.id = s.shop_id
  where a.id = p_application_id;

  if not found then
    raise exception 'application_not_found';
  end if;

  -- auth.uid() is the CALLER even under SECURITY DEFINER — a real ownership gate.
  if v_owner is distinct from auth.uid() then
    raise exception 'not_shift_owner';
  end if;

  -- Only resolvable for an already-accepted application (no fishing).
  if v_app_status <> 'accepted' then
    raise exception 'application_not_accepted';
  end if;

  -- The accepted worker's linked LINE userId, if any (NULL when not linked).
  select la.line_user_id
    into v_line_user_id
  from public.applications a
  join public.workers w on w.id = a.worker_id
  join public.line_accounts la on la.user_id = w.user_id
  where a.id = p_application_id;

  return v_line_user_id;  -- NULL if the worker has no linked LINE account
end;
$$;

-- Least privilege: only logged-in users may call it. Supabase grants EXECUTE to
-- `anon` directly, so revoke from anon explicitly (mirrors the other RPCs).
revoke all on function public.get_line_push_target(uuid) from public, anon;
grant execute on function public.get_line_push_target(uuid) to authenticated;
