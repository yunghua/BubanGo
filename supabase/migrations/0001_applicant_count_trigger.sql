-- BubanGo migration 0001 — maintain shifts.applicant_count via trigger
--
-- Why this exists:
--   shifts.applicant_count is denormalized so the worker browse list can show
--   "N 人申請" without exposing other workers' application rows. Under RLS a
--   worker can INSERT an application but CANNOT UPDATE the shift row, so the
--   count cannot be bumped from the client. This SECURITY DEFINER trigger keeps
--   the count correct on INSERT/DELETE regardless of who performs the action.
--
--   It does NOT weaken table RLS: all direct table access from the app still
--   goes through the policies. Run this once in the Supabase SQL Editor.
--
-- Idempotent: safe to run multiple times.

create or replace function public.sync_applicant_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.shifts
      set applicant_count = applicant_count + 1
      where id = new.shift_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.shifts
      set applicant_count = greatest(applicant_count - 1, 0)
      where id = old.shift_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists applications_sync_count on public.applications;

create trigger applications_sync_count
  after insert or delete on public.applications
  for each row execute function public.sync_applicant_count();

-- Optional one-time reconcile (run if you already have application rows):
-- update public.shifts s
--   set applicant_count = (
--     select count(*) from public.applications a where a.shift_id = s.id
--   );
