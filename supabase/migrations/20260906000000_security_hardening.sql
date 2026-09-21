-- VSAS defense-in-depth hardening.
-- Apply after the existing migrations. This migration removes permissive legacy
-- policies and narrows browser capabilities; service-role Edge Functions retain
-- their intended privileged path.

-- Profiles: no browser inserts/deletes, and only contact/avatar updates.
drop policy if exists "Service role can insert profiles" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Admins can update all profiles" on public.profiles;
drop policy if exists "Managers can update profiles" on public.profiles;
drop policy if exists "Managers can delete profiles" on public.profiles;
drop policy if exists "Profiles: own contact update" on public.profiles;

create policy "Profiles: own contact update only"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

revoke insert, delete, update on public.profiles from anon, authenticated;
grant update (phone, avatar_url) on public.profiles to authenticated;

-- Storage: keep legacy public reads for existing avatar URLs, but prevent
-- arbitrary authenticated users from writing another user's object path.
drop policy if exists "Anyone can upload an avatar" on storage.objects;
drop policy if exists "Anyone can update own avatar" on storage.objects;
drop policy if exists "Admins can delete any avatar" on storage.objects;

create policy "Avatars: owner upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
  and name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.(jpg|jpeg|png)$'
);

create policy "Avatars: owner update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Avatars: owner or admin delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_vvas_admin()
  )
);

-- Audit records are append-only to browser users and readable only by managers.
revoke insert, update, delete on public.activity_logs from anon, authenticated;

-- Browser clients cannot mutate announcements or notification definitions.
revoke insert, update, delete on public.announcements from anon, authenticated;
revoke insert, update, delete on public.notifications from anon, authenticated;
revoke insert, delete on public.notification_recipients from anon, authenticated;

-- Enforce useful bounds at the database boundary too.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (lower(role) in ('admin', 'hr', 'manager', 'ceo', 'staff', 'intern'));

alter table public.activity_logs drop constraint if exists activity_logs_metadata_object_check;
alter table public.activity_logs add constraint activity_logs_metadata_object_check
  check (jsonb_typeof(metadata) = 'object');

-- Attendance integrity: users may not create future records or rewrite their
-- identity/date/check-in after insertion. Managers retain correction access.
create or replace function public.validate_attendance_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.work_date > current_date then
    raise exception 'Attendance date cannot be in the future';
  end if;
  if new.check_in is not null and new.check_in > now() + interval '5 minutes' then
    raise exception 'Check-in time cannot be in the future';
  end if;
  if new.check_out is not null and new.check_out > now() + interval '5 minutes' then
    raise exception 'Check-out time cannot be in the future';
  end if;
  if new.check_out is not null and new.check_in is not null and new.check_out < new.check_in then
    raise exception 'Check-out time cannot precede check-in time';
  end if;
  if tg_op = 'UPDATE' and not public.is_staff_manager() then
    if new.staff_id is distinct from old.staff_id or new.work_date is distinct from old.work_date or new.check_in is distinct from old.check_in then
      raise exception 'Attendance identity and check-in are immutable';
    end if;
    if old.check_out is not null and new.check_out is distinct from old.check_out then
      raise exception 'A completed attendance record cannot be reopened or rewritten';
    end if;
    if old.check_out is null and new.check_out is null and new.check_in is null then
      raise exception 'Attendance must contain a check-in';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_attendance_event on public.attendance;
create trigger trg_validate_attendance_event
before insert or update on public.attendance
for each row execute function public.validate_attendance_event();

-- The dashboard only requests today's aggregate. Historical workforce counts
-- must not be queryable by arbitrary authenticated callers.
create or replace function public.today_attendance_summary(target_date date)
returns table (total_active_staff bigint, checked_in bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if target_date <> current_date then
    raise exception 'Only the current attendance date is available';
  end if;
  return query
    select
      (select count(*) from public.profiles where is_active is not false),
      (select count(*) from public.attendance where work_date = current_date and check_in is not null);
end;
$$;
revoke all on function public.today_attendance_summary(date) from public;
grant execute on function public.today_attendance_summary(date) to authenticated;

-- These functions are called from policies and must not be executable by the
-- public role. Authenticated users only need the policy evaluation path.
revoke all on function public.is_staff_manager() from public;
revoke all on function public.is_vvas_admin() from public;
grant execute on function public.is_staff_manager() to authenticated;
grant execute on function public.is_vvas_admin() to authenticated;
