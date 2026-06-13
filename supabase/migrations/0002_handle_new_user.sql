-- BubanGo migration 0002 — auto-create profile + role row on sign-up
--
-- WHEN YOU NEED THIS:
--   Only if you keep "Confirm email" ENABLED in Supabase Auth. With confirmation
--   on, sign-up returns no client session, so the app cannot create the
--   profile / shop / worker rows itself. This trigger creates them server-side
--   from the sign-up metadata the app sends (role, display_name, phone,
--   address, experience), so onboarding is complete by the time the user
--   confirms their email and logs in.
--
--   If you DISABLE email confirmation instead, you do NOT need this trigger —
--   the app creates those rows on the client (idempotently). Installing it is
--   still safe in that case: the client's inserts no-op when rows already exist.
--
-- SECURITY NOTE:
--   SECURITY DEFINER lets the trigger insert into public.* while the new user
--   has no session yet. This is the standard Supabase "new user" pattern and is
--   the ONLY privileged path in the app. It does NOT relax table RLS: every
--   query the app issues still goes through the policies. Review before running.
--
-- Idempotent: safe to run multiple times.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(new.raw_user_meta_data->>'role', 'worker');
begin
  insert into public.profiles (id, display_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data->>'phone', ''),
    case when v_role = 'shop_owner' then 'shop_owner' else 'worker' end
  )
  on conflict (id) do nothing;

  if v_role = 'shop_owner' then
    insert into public.shops (owner_id, name, address, description)
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), '我的店家'),
      coalesce(new.raw_user_meta_data->>'address', ''),
      nullif(new.raw_user_meta_data->>'description', '')
    );
  else
    insert into public.workers (user_id, name, phone, experience)
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), '打工者'),
      nullif(new.raw_user_meta_data->>'phone', ''),
      nullif(new.raw_user_meta_data->>'experience', '')
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
