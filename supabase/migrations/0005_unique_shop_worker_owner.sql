-- BubanGo migration 0005 — one shop per owner, one worker per user
--
-- Enforces at the database level what the onboarding fallback already tries to
-- enforce in the UI/service layer, closing the theoretical race where the same
-- user ends up with two shops / two workers.
--
-- PRODUCT DECISION (MVP): a shop owner has exactly ONE shop. If BubanGo later
-- supports multiple stores per owner, drop the unique index below and move to a
-- multi-store model (shop selector + per-shop context; getCurrentSession would
-- need to stop assuming a single shop via limit(1)). Documented in
-- docs/SUPABASE_SCHEMA.md.
--
-- SAFETY: this migration NEVER deletes data. If duplicates already exist it
-- RAISES with the offending owner/user ids and stops, so you can clean them up
-- manually (delete the extra test users in Authentication → Users — that
-- cascades — keeping the oldest real row). Re-run after cleanup.
--
-- Idempotent: uses `create unique index if not exists`; the detection block is
-- read-only.

do $$
declare
  dup_shops   text;
  dup_workers text;
begin
  select string_agg(format('%s (x%s)', owner_id, cnt), ', ')
    into dup_shops
  from (
    select owner_id, count(*) as cnt
    from public.shops
    group by owner_id
    having count(*) > 1
  ) d;

  select string_agg(format('%s (x%s)', user_id, cnt), ', ')
    into dup_workers
  from (
    select user_id, count(*) as cnt
    from public.workers
    group by user_id
    having count(*) > 1
  ) d;

  if dup_shops is not null then
    raise exception
      'Cannot add unique index: duplicate shops per owner_id: %. No data was deleted. Remove the extra rows (e.g. delete the duplicate test users in Authentication -> Users, which cascades; keep the oldest by created_at), then re-run this migration.',
      dup_shops;
  end if;

  if dup_workers is not null then
    raise exception
      'Cannot add unique index: duplicate workers per user_id: %. No data was deleted. Remove the extra rows, then re-run this migration.',
      dup_workers;
  end if;
end $$;

-- No duplicates → enforce uniqueness. These also serve as the lookup index,
-- making the older non-unique shops_owner_id_idx / workers_user_id_idx redundant
-- (left in place; harmless).
create unique index if not exists shops_owner_id_unique on public.shops (owner_id);
create unique index if not exists workers_user_id_unique on public.workers (user_id);
