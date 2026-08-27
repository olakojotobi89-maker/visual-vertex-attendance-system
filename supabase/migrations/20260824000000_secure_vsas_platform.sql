-- VSAS production hardening and collaboration features.
--
-- Additive migration:
-- - Preserves existing profile/department data.
-- - Does not assume legacy attendance column names.
-- - Safely upgrades existing installations.
-- - Service role remains the trusted path for privileged writes.


/* =========================================================
   1. ADMIN / MANAGER HELPERS
   ========================================================= */

create or replace function public.is_vvas_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and lower(role) = 'admin'
  );
$$;


/* =========================================================
   2. REPAIR LEGACY PROFILE POLICIES
   ========================================================= */

drop policy if exists "Users can view own profile"
  on public.profiles;

drop policy if exists "Admins can view all profiles"
  on public.profiles;

drop policy if exists "Managers can view all profiles"
  on public.profiles;

drop policy if exists "Users can update own profile"
  on public.profiles;

drop policy if exists "Admins can update all profiles"
  on public.profiles;

drop policy if exists "Managers can update profiles"
  on public.profiles;

drop policy if exists "Managers can delete profiles"
  on public.profiles;

drop policy if exists "Service role can insert profiles"
  on public.profiles;


create policy "Profiles: own read or staff manager read"
on public.profiles
for select
using (
  id = auth.uid()
  or public.is_staff_manager()
);


create policy "Profiles: own contact update"
on public.profiles
for update
using (
  id = auth.uid()
)
with check (
  id = auth.uid()
);


/*
  PostgREST honors column privileges in addition to RLS.

  Browser users may only update:
  - phone
  - avatar_url

  Privileged lifecycle changes should be performed through
  trusted Edge Functions using service-role credentials.
*/

revoke insert, update, delete
on public.profiles
from anon, authenticated;

grant select
on public.profiles
to authenticated;

grant update (phone, avatar_url)
on public.profiles
to authenticated;


/* =========================================================
   3. DEPARTMENT RELATIONSHIP
   ========================================================= */

/*
  Existing departments.id is BIGINT.
  Therefore profiles.department_id must also be BIGINT.
*/

alter table public.profiles
  add column if not exists department_id bigint;


/*
  Preserve existing free-text department values by creating
  missing department records first.
*/

insert into public.departments (name)
select distinct
  btrim(department)
from public.profiles
where nullif(btrim(department), '') is not null
on conflict (name) do nothing;


/*
  Connect existing profiles to their department records.
*/

update public.profiles p
set department_id = d.id
from public.departments d
where p.department_id is null
  and lower(btrim(p.department)) = lower(d.name);


/*
  Add the foreign key only if it does not already exist.
*/

do $$
begin

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_department_id_fkey'
  ) then

    alter table public.profiles
      add constraint profiles_department_id_fkey
      foreign key (department_id)
      references public.departments(id)
      on delete set null
      not valid;

    alter table public.profiles
      validate constraint profiles_department_id_fkey;

  end if;

end $$;


create index if not exists profiles_department_id_idx
on public.profiles(department_id);


create index if not exists profiles_active_department_idx
on public.profiles(is_active, department_id);


/* =========================================================
   4. ATTENDANCE COMPATIBILITY / MIGRATION
   ========================================================= */

/*
  IMPORTANT:
  Older versions of this migration assumed that attendance had:

      staff_id
      work_date

  Your current database does not have staff_id.

  Therefore we DO NOT directly execute:

      update public.attendance
      set user_id = staff_id,
          attendance_date = work_date;

  Instead, the migration checks the actual columns first.

  Supported legacy conversion:
      staff_id + work_date
        ->
      user_id + attendance_date

  If those legacy columns do not exist, nothing is changed.

  This makes the migration safe across different VSAS
  installations.
*/

do $$
declare
  has_staff_id boolean;
  has_work_date boolean;
  has_user_id boolean;
  has_attendance_date boolean;
begin

  /*
    First check whether the attendance table exists.
  */

  if to_regclass('public.attendance') is null then

    raise notice
      'Attendance table does not exist. Attendance migration skipped.';

    return;

  end if;


  /*
    Check actual attendance columns.
  */

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'attendance'
      and column_name = 'staff_id'
  )
  into has_staff_id;


  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'attendance'
      and column_name = 'work_date'
  )
  into has_work_date;


  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'attendance'
      and column_name = 'user_id'
  )
  into has_user_id;


  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'attendance'
      and column_name = 'attendance_date'
  )
  into has_attendance_date;


  /*
    Only perform the legacy conversion when ALL required
    columns actually exist.
  */

  if has_staff_id
     and has_work_date
     and has_user_id
     and has_attendance_date then

    execute $sql$
      update public.attendance
      set
        user_id = staff_id,
        attendance_date = work_date
      where user_id is null
        and staff_id is not null
    $sql$;

    raise notice
      'Legacy attendance data converted from staff_id/work_date.';

  else

    raise notice
      'Legacy attendance columns staff_id/work_date were not found. Attendance conversion skipped.';

  end if;

end $$;


/* =========================================================
   5. ACTIVITY LOGS
   ========================================================= */

create table if not exists public.activity_logs (

  id uuid primary key default gen_random_uuid(),

  actor_id uuid
    references auth.users(id)
    on delete set null,

  action text not null,

  entity_type text not null,

  entity_id uuid,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()

);


/*
  Existing installations may already have activity_logs
  without the newer columns.

  Add missing columns without destroying existing records.
*/

alter table public.activity_logs
  add column if not exists actor_id uuid;

alter table public.activity_logs
  add column if not exists action text;

alter table public.activity_logs
  add column if not exists entity_type text;

alter table public.activity_logs
  add column if not exists entity_id uuid;

alter table public.activity_logs
  add column if not exists metadata jsonb
  not null
  default '{}'::jsonb;

alter table public.activity_logs
  add column if not exists created_at timestamptz
  not null
  default now();


/*
  Add actor foreign key only when it does not already exist.
*/

do $$
begin

  if not exists (
    select 1
    from pg_constraint
    where conname = 'activity_logs_actor_id_fkey'
  ) then

    alter table public.activity_logs
      add constraint activity_logs_actor_id_fkey
      foreign key (actor_id)
      references auth.users(id)
      on delete set null
      not valid;

    alter table public.activity_logs
      validate constraint activity_logs_actor_id_fkey;

  end if;

end $$;


create index if not exists activity_logs_created_at_idx
on public.activity_logs(created_at desc);


create index if not exists activity_logs_actor_created_idx
on public.activity_logs(actor_id, created_at desc);


/*
  Enable RLS.
*/

alter table public.activity_logs
enable row level security;


drop policy if exists "Activity logs: managers read"
on public.activity_logs;


create policy "Activity logs: managers read"
on public.activity_logs
for select
using (
  public.is_staff_manager()
);


/* =========================================================
   6. ANNOUNCEMENTS
   ========================================================= */

create table if not exists public.announcements (

  id uuid primary key default gen_random_uuid(),

  title text not null
    check (char_length(title) between 1 and 180),

  content text not null
    check (char_length(content) between 1 and 10000),

  category text,

  is_published boolean not null default false,

  published_at timestamptz,

  archived_at timestamptz,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()

);


create index if not exists announcements_feed_idx
on public.announcements(
  is_published,
  archived_at,
  published_at desc
);


alter table public.announcements
enable row level security;


drop policy if exists "Announcements: published read"
on public.announcements;


create policy "Announcements: published read"
on public.announcements
for select
using (
  (
    is_published
    and archived_at is null
  )
  or public.is_staff_manager()
);


/* =========================================================
   7. NOTIFICATIONS
   ========================================================= */

create table if not exists public.notifications (

  id uuid primary key default gen_random_uuid(),

  title text not null
    check (char_length(title) between 1 and 180),

  body text not null
    check (char_length(body) between 1 and 10000),

  target_type text not null
    check (
      target_type in (
        'all',
        'department',
        'selected'
      )
    ),

  /*
    Existing departments.id is BIGINT.
  */

  department_id bigint
    references public.departments(id)
    on delete set null,

  status text not null default 'draft'
    check (
      status in (
        'draft',
        'published',
        'archived'
      )
    ),

  published_at timestamptz,

  archived_at timestamptz,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()

);


/*
  Existing installations may already have notifications.

  Add category without replacing existing data.
*/

alter table public.notifications
  add column if not exists category text;


/* =========================================================
   8. NOTIFICATION RECIPIENTS
   ========================================================= */

create table if not exists public.notification_recipients (

  notification_id uuid not null
    references public.notifications(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  read_at timestamptz,

  dismissed_at timestamptz,

  created_at timestamptz not null default now(),

  primary key (
    notification_id,
    user_id
  )

);


create index if not exists notification_recipients_inbox_idx
on public.notification_recipients(
  user_id,
  dismissed_at,
  read_at,
  created_at desc
);


create index if not exists notifications_status_published_idx
on public.notifications(
  status,
  published_at desc
);


/* =========================================================
   9. NOTIFICATION RLS
   ========================================================= */

alter table public.notifications
enable row level security;


alter table public.notification_recipients
enable row level security;


drop policy if exists "Notifications: managers read"
on public.notifications;


drop policy if exists "Notification recipients: own read"
on public.notification_recipients;


drop policy if exists "Notification recipients: own update"
on public.notification_recipients;


/*
  Managers can view notification definitions.
*/

create policy "Notifications: managers read"
on public.notifications
for select
using (
  public.is_staff_manager()
);


/*
  Users can only see their own recipient records.
*/

create policy "Notification recipients: own read"
on public.notification_recipients
for select
using (
  user_id = auth.uid()
);


/*
  Users can update only their own read/dismiss state.
*/

create policy "Notification recipients: own update"
on public.notification_recipients
for update
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);


/*
  Browser clients cannot directly create/delete notifications
  or recipient records.

  Those operations should go through the trusted server-side
  Edge Function.
*/

revoke insert, delete
on public.notifications, public.notification_recipients
from anon, authenticated;


/* =========================================================
   10. REALTIME
   ========================================================= */

/*
  Realtime is limited by notification recipient RLS.
*/

do $$
begin

  begin

    execute '
      alter publication supabase_realtime
      add table public.notification_recipients
    ';

  exception
    when duplicate_object then

      null;

    when others then

      raise notice
        'Realtime publication skipped: %',
        sqlerrm;

  end;

end $$;


/* =========================================================
   11. FINAL INDEXES
   ========================================================= */

create index if not exists notifications_department_idx
on public.notifications(department_id);


create index if not exists notifications_created_by_idx
on public.notifications(created_by);


create index if not exists announcements_created_by_idx
on public.announcements(created_by);


/* =========================================================
   12. MIGRATION COMPLETE
   ========================================================= */

raise notice
  'VSAS production hardening and collaboration migration completed successfully.';