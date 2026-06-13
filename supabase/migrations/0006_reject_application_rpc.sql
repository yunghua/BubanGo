-- BubanGo migration 0006 — atomic reject_application RPC
--
-- Replaces the repository's read-then-write reject (which recomputed shift
-- status in a separate query) with one transactional function that locks the
-- shift row FOR UPDATE. Rejecting an *accepted* worker can drop the shift below
-- its quota; this flips `matched` back to `open` atomically so the shift can be
-- filled again.
--
-- SECURITY MODEL — SECURITY INVOKER (like accept_application):
--   The caller is the shop owner, who already has every needed privilege via
--   RLS (read own shift's applications, FOR UPDATE their own shift, update their
--   own shift + its applications). No escalation needed — RLS stays in force.
--   We additionally validate auth.uid() against the shop owner to return a clear
--   `not_shift_owner` error instead of a raw RLS miss. No service_role.
--
-- Errors (message text; SQLSTATE P0001):
--   not_authenticated | application_not_found | not_shift_owner
--   | shift_not_editable | application_not_rejectable
--
-- Idempotent: safe to run multiple times.

create or replace function public.reject_application(p_application_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_shift_id  uuid;
  v_owner     uuid;
  v_status    text;   -- shift status
  v_required  integer;
  v_app_status text;
  v_accepted  integer;
begin
  -- (1) authenticated
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- (2) application exists? grab its shift
  select shift_id into v_shift_id
  from public.applications
  where id = p_application_id;
  if not found then
    raise exception 'application_not_found';
  end if;

  -- (3) ownership — read owner without locking (shops/shifts readable; the write
  -- is what RLS gates). Done before the lock so a non-owner gets a clean error.
  select sh.owner_id into v_owner
  from public.shifts s
  join public.shops sh on sh.id = s.shop_id
  where s.id = v_shift_id;
  if not found then
    raise exception 'application_not_found';
  end if;
  if v_owner is distinct from v_uid then
    raise exception 'not_shift_owner';
  end if;

  -- (4) lock the shift row for the rest of the transaction
  select status, required_workers
    into v_status, v_required
  from public.shifts
  where id = v_shift_id
  for update;

  -- (9) shift must still be editable
  if v_status in ('completed', 'cancelled') then
    raise exception 'shift_not_editable';
  end if;

  -- (5) re-read application status under the shift lock
  select status into v_app_status
  from public.applications
  where id = p_application_id;

  -- (6,10) only pending/accepted are rejectable
  if v_app_status not in ('pending', 'accepted') then
    raise exception 'application_not_rejectable';
  end if;

  -- (7,8) reject it
  update public.applications
  set status = 'rejected'
  where id = p_application_id;

  -- recompute accepted count inside the transaction
  select count(*) into v_accepted
  from public.applications
  where shift_id = v_shift_id and status = 'accepted';

  -- (8) a matched shift that dropped below quota reopens
  if v_status = 'matched' and v_accepted < v_required then
    update public.shifts set status = 'open' where id = v_shift_id;
    v_status := 'open';
  end if;

  -- (11) stable payload
  return jsonb_build_object(
    'application_id', p_application_id,
    'application_status', 'rejected',
    'shift_id', v_shift_id,
    'shift_status', v_status,
    'accepted_count', v_accepted,
    'required_workers', v_required
  );
end;
$$;

-- Least privilege: only logged-in users may call it (RLS still applies inside).
revoke all on function public.reject_application(uuid) from public, anon;
grant execute on function public.reject_application(uuid) to authenticated;
