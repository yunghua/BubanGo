-- BubanGo migration 0004 — atomic apply_to_shift RPC
--
-- Moves "worker applies to a shift" into one transactional function that derives
-- the worker from auth.uid() (never trusts client input) and locks the shift row
-- FOR UPDATE so an apply cannot slip in while the shift is being matched.
--
-- SECURITY MODEL — intentionally SECURITY DEFINER (unlike accept_application,
-- which is INVOKER):
--   The caller is a *worker*, but the function must take a FOR UPDATE lock on a
--   shift the worker does NOT own. Under RLS the shifts UPDATE policy only
--   permits the shop owner, so a worker cannot reliably lock the shift row as
--   INVOKER. Locking is required (race-protection vs concurrent accepts), so
--   SECURITY DEFINER is required here.
--
--   The security INTENT of RLS is preserved by explicit checks, not bypassed:
--     * auth.uid() must be present                 -> not_authenticated
--     * profiles.role must be 'worker'             -> not_worker
--     * the worker row is derived from auth.uid()  -> worker_not_found
--       (the p_* args carry NO identity; client-supplied worker ids are ignored)
--     * shift must exist / be open / not full      -> shift_not_found/_not_open/_already_full
--     * one application per (shift, worker)         -> already_applied
--   This is strictly tighter than the old client path, which trusted a
--   client-passed worker id.
--
-- applicant_count is maintained by the existing trigger (migration 0001) on
-- INSERT — this function does not touch it.
--
-- Errors (message text; SQLSTATE P0001):
--   not_authenticated | not_worker | worker_not_found | shift_not_found
--   | shift_not_open | shift_already_full | already_applied
--
-- Idempotent: safe to run multiple times.

create or replace function public.apply_to_shift(p_shift_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_role      text;
  v_worker_id uuid;
  v_status    text;
  v_required  integer;
  v_accepted  integer;
  v_app_id    uuid;
  v_created   timestamptz;
begin
  -- (1) must be authenticated.
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- (2) must have the worker role (shop owners are rejected here).
  select role into v_role from public.profiles where id = v_uid;
  if not found or v_role is distinct from 'worker' then
    raise exception 'not_worker';
  end if;

  -- (3) derive the worker row from auth.uid() — client input is never trusted.
  select id into v_worker_id
  from public.workers
  where user_id = v_uid
  order by created_at asc
  limit 1;
  if not found then
    raise exception 'worker_not_found';
  end if;

  -- (4,5) lock the shift row for the rest of the transaction; must exist.
  select status, required_workers
    into v_status, v_required
  from public.shifts
  where id = p_shift_id
  for update;
  if not found then
    raise exception 'shift_not_found';
  end if;

  -- (6) shift must be open (rejects matched/completed/cancelled).
  if v_status <> 'open' then
    raise exception 'shift_not_open';
  end if;

  -- (7) shift must not already be full (race backstop; a full shift is normally
  -- already 'matched' and caught above).
  select count(*) into v_accepted
  from public.applications
  where shift_id = p_shift_id and status = 'accepted';
  if v_accepted >= v_required then
    raise exception 'shift_already_full';
  end if;

  -- (8) one application per (shift, worker). The shift lock serializes concurrent
  -- applies by the same worker, so this check is race-free (also backed by the
  -- unique (shift_id, worker_id) constraint).
  if exists (
    select 1 from public.applications
    where shift_id = p_shift_id and worker_id = v_worker_id
  ) then
    raise exception 'already_applied';
  end if;

  -- (9) insert; (10) applicant_count is bumped by the trigger from migration 0001.
  insert into public.applications (shift_id, worker_id, status)
  values (p_shift_id, v_worker_id, 'pending')
  returning id, created_at into v_app_id, v_created;

  -- (11) stable payload.
  return jsonb_build_object(
    'application_id', v_app_id,
    'shift_id', p_shift_id,
    'worker_id', v_worker_id,
    'status', 'pending',
    'created_at', v_created
  );
end;
$$;

-- Least privilege: only logged-in users may call it. Supabase grants EXECUTE
-- to `anon` directly (not just via PUBLIC), so revoke from anon explicitly to
-- make this strictly authenticated-only. (The function also rejects anon via the
-- not_authenticated check, so this is defense in depth.)
revoke all on function public.apply_to_shift(uuid) from public, anon;
grant execute on function public.apply_to_shift(uuid) to authenticated;
