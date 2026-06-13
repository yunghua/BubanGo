-- BubanGo migration 0003 — atomic accept_application RPC
--
-- Replaces the repository's two-step "update application, then recompute shift"
-- (which had a race when two accepts compete for the last slot) with a single
-- transactional function that locks the shift row FOR UPDATE.
--
-- SECURITY MODEL — intentionally SECURITY INVOKER (not DEFINER):
--   The shop owner already has every privilege this function needs via existing
--   RLS policies (read own shift's applications, FOR UPDATE their own shift,
--   update their own shift + its applications). So no privilege escalation is
--   required — RLS stays fully in force inside the function, which is the safest
--   reading of "don't bypass RLS". We additionally validate auth.uid() against
--   the shop owner to return a clear `not_shift_owner` error instead of a raw
--   RLS miss. No service_role, no weakening of policies.
--
-- Errors raised (message text; SQLSTATE P0001):
--   application_not_found | not_shift_owner | shift_not_open
--   | application_not_pending | shift_already_full
--
-- Idempotent: safe to run multiple times.

create or replace function public.accept_application(p_application_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_shift_id  uuid;
  v_owner     uuid;
  v_status    text;   -- shift status
  v_required  integer;
  v_app_status text;
  v_accepted  integer;
begin
  -- (3) application exists? grab its shift.
  select shift_id into v_shift_id
  from public.applications
  where id = p_application_id;

  if not found then
    raise exception 'application_not_found';
  end if;

  -- (1) ownership check — read owner without locking (shops/shifts are readable
  -- by all authenticated users; the write is what RLS gates). Done before the
  -- lock so a non-owner gets a clean error rather than touching the row.
  select sh.owner_id into v_owner
  from public.shifts s
  join public.shops sh on sh.id = s.shop_id
  where s.id = v_shift_id;

  if not found then
    raise exception 'application_not_found';
  end if;

  if v_owner is distinct from auth.uid() then
    raise exception 'not_shift_owner';
  end if;

  -- (2) lock the shift row for the rest of the transaction. This serializes
  -- concurrent accepts for the same shift — the core of the race fix.
  select status, required_workers
    into v_status, v_required
  from public.shifts
  where id = v_shift_id
  for update;

  -- (5) shift must be open.
  if v_status <> 'open' then
    raise exception 'shift_not_open';
  end if;

  -- (6) application must still be pending — re-read under the shift lock so we
  -- see the committed state of any accept that won the lock before us.
  select status into v_app_status
  from public.applications
  where id = p_application_id;

  if v_app_status <> 'pending' then
    raise exception 'application_not_pending';
  end if;

  -- (7,8) capacity check while holding the lock.
  select count(*) into v_accepted
  from public.applications
  where shift_id = v_shift_id and status = 'accepted';

  if v_accepted >= v_required then
    raise exception 'shift_already_full';
  end if;

  -- (9) accept the target application.
  update public.applications
  set status = 'accepted'
  where id = p_application_id;

  -- (10) recount inside the same transaction.
  select count(*) into v_accepted
  from public.applications
  where shift_id = v_shift_id and status = 'accepted';

  -- (11) flip the shift to matched once the quota is met.
  if v_accepted >= v_required then
    update public.shifts set status = 'matched' where id = v_shift_id;
    v_status := 'matched';
  else
    v_status := 'open';
  end if;

  -- (12) stable result payload.
  return jsonb_build_object(
    'application_id', p_application_id,
    'shift_id', v_shift_id,
    'application_status', 'accepted',
    'shift_status', v_status,
    'accepted_count', v_accepted,
    'required_workers', v_required
  );
end;
$$;

-- Least privilege: only logged-in users may call it (RLS still applies inside).
-- Supabase grants EXECUTE to `anon` directly, so revoke from anon explicitly.
revoke all on function public.accept_application(uuid) from public, anon;
grant execute on function public.accept_application(uuid) to authenticated;
