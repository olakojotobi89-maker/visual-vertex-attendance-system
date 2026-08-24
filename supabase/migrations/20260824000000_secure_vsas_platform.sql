-- VSAS production hardening and collaboration features.
-- Additive migration: it preserves existing profile/department data.

create or replace function public.is_vvas_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and lower(role) = 'admin');
$$;

-- Repair permissive legacy profile policies. Service role bypasses RLS and
-- therefore must never have a client-visible policy.
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "Managers can view all profiles" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Admins can update all profiles" on public.profiles;
drop policy if exists "Managers can update profiles" on public.profiles;
drop policy if exists "Managers can delete profiles" on public.profiles;
drop policy if exists "Service role can insert profiles" on public.profiles;

create policy "Profiles: own read or staff manager read" on public.profiles for select
  using (id = auth.uid() or public.is_staff_manager());
create policy "Profiles: own contact update" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- PostgREST honors column privileges in addition to RLS. Browser users may
-- only update their own phone/avatar; privileged lifecycle updates are Edge
-- Function operations using service role credentials.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (phone, avatar_url) on public.profiles to authenticated;

-- Normalize existing free-text department values without discarding them.
alter table public.profiles add column if not exists department_id uuid;
insert into public.departments (name)
select distinct btrim(department) from public.profiles
where nullif(btrim(department), '') is not null
on conflict (name) do nothing;
update public.profiles p set department_id = d.id
from public.departments d
where p.department_id is null and lower(btrim(p.department)) = lower(d.name);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_department_id_fkey') then
    alter table public.profiles add constraint profiles_department_id_fkey
      foreign key (department_id) references public.departments(id) on delete set null not valid;
    alter table public.profiles validate constraint profiles_department_id_fkey;
  end if;
end $$;
create index if not exists profiles_department_id_idx on public.profiles(department_id);
create index if not exists profiles_active_department_idx on public.profiles(is_active, department_id);

-- Audit log: clients may read scoped records but never create/edit/delete them.
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_logs_created_at_idx on public.activity_logs(created_at desc);
create index if not exists activity_logs_actor_created_idx on public.activity_logs(actor_id, created_at desc);
alter table public.activity_logs enable row level security;
drop policy if exists "Activity logs: managers read" on public.activity_logs;
create policy "Activity logs: managers read" on public.activity_logs for select using (public.is_staff_manager());

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 180),
  content text not null check (char_length(content) between 1 and 10000),
  category text,
  is_published boolean not null default false,
  published_at timestamptz,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists announcements_feed_idx on public.announcements(is_published, archived_at, published_at desc);
alter table public.announcements enable row level security;
drop policy if exists "Announcements: published read" on public.announcements;
create policy "Announcements: published read" on public.announcements for select
  using ((is_published and archived_at is null) or public.is_staff_manager());

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 180),
  body text not null check (char_length(body) between 1 and 10000),
  target_type text not null check (target_type in ('all','department','selected')),
  department_id uuid references public.departments(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.notification_recipients (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);
create index if not exists notification_recipients_inbox_idx on public.notification_recipients(user_id, dismissed_at, read_at, created_at desc);
create index if not exists notifications_status_published_idx on public.notifications(status, published_at desc);
alter table public.notifications enable row level security;
alter table public.notification_recipients enable row level security;
drop policy if exists "Notifications: managers read" on public.notifications;
drop policy if exists "Notification recipients: own read" on public.notification_recipients;
drop policy if exists "Notification recipients: own update" on public.notification_recipients;
create policy "Notifications: managers read" on public.notifications for select using (public.is_staff_manager());
create policy "Notification recipients: own read" on public.notification_recipients for select using (user_id = auth.uid());
create policy "Notification recipients: own update" on public.notification_recipients for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, delete on public.notifications, public.notification_recipients from anon, authenticated;

-- Realtime is limited by notification recipient RLS.
do $$ begin
  execute 'alter publication supabase_realtime add table public.notification_recipients';
exception when duplicate_object then null; when others then raise notice 'Realtime publication skipped: %', sqlerrm;
end $$;
