-- BubanGo migration 0008 — LINE Login primary: role-optional sign-up trigger
--
-- WHY:
--   LINE Login is now the primary user-facing login (via a Supabase Custom OAuth
--   provider, identifier `custom:line`). First-time LINE users sign in WITHOUT a
--   role in their auth metadata, so the 0002 trigger's old behavior —
--   `coalesce(role, 'worker')` — would silently mis-provision every LINE user as
--   a worker (and create a "打工者" row). Instead we want them to land in
--   onboarding and choose 身分 (店家 / 打工者) themselves.
--
-- WHAT CHANGES:
--   handle_new_user() now SKIPS provisioning entirely when the sign-up metadata
--   has no valid role. Email/password sign-ups (which always send role in
--   metadata) are unaffected and still get their profile + shop/worker row.
--   Onboarding (src/lib/auth/onboarding-service.ts) creates the profile + role
--   row for role-less users afterwards, under RLS.
--
-- SAFETY:
--   * SECURITY DEFINER is unchanged — still the only privileged path, still does
--     NOT relax table RLS (the app's own queries still go through policies).
--   * Never fails the auth.users insert: a missing/invalid role simply returns
--     early, so OAuth sign-up always succeeds.
--   * Existing auth.users / profiles / shops / workers rows are NOT touched.
--   * Existing RPCs and RLS policies are NOT modified.
--   * Idempotent (create or replace + drop/create trigger); inserts use
--     on conflict do nothing so re-runs and races are harmless.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := new.raw_user_meta_data->>'role';
begin
  -- First-time LINE / OIDC users have no role yet → let onboarding ask for it.
  -- Returning early keeps the auth insert from ever failing on missing metadata.
  if v_role is null or v_role not in ('shop_owner', 'worker') then
    return new;
  end if;

  insert into public.profiles (id, display_name, phone, role)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      '使用者'
    ),
    nullif(new.raw_user_meta_data->>'phone', ''),
    v_role
  )
  on conflict (id) do nothing;

  if v_role = 'shop_owner' then
    insert into public.shops (owner_id, name, address, description)
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), '我的店家'),
      coalesce(new.raw_user_meta_data->>'address', ''),
      nullif(new.raw_user_meta_data->>'description', '')
    )
    on conflict (owner_id) do nothing; -- shops_owner_id_unique (0005)
  else
    insert into public.workers (user_id, name, phone, experience)
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), '打工者'),
      nullif(new.raw_user_meta_data->>'phone', ''),
      nullif(new.raw_user_meta_data->>'experience', '')
    )
    on conflict (user_id) do nothing; -- workers_user_id_unique (0005)
  end if;

  return new;
end;
$$;

-- Re-assert the trigger (idempotent; unchanged from 0002).
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
