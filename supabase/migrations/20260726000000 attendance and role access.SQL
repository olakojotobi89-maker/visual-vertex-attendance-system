-- -----------------------------------------------------------------------
-- 20260726000000_attendance_and_role_access.sql
--
-- Adds:
--   1. A shared is_staff_manager() helper (admin/hr/manager/ceo check).
--   2. Expands the previous "admin-only" profiles policies to that group,
--      matching login.js, which now routes all four roles to
--      staff-management.html.
--   3. A real "attendance" table (check-in/check-out), with RLS so staff
--      only ever touch their own row and managers can see everyone's.
--   4. Realtime enabled on "attendance" so staff-management.html updates
--      live, with no polling or localStorage involved.
--   5. A security-definer RPC returning only aggregate counts (never
--      individual rows) so any signed-in staff member can show a
--      company-wide "checked in today" summary on their own dashboard
--      without being able to see who specifically is checked in.
--
-- Safe to run multiple times — every statement is idempotent.
-- -----------------------------------------------------------------------

-- 1. Shared role-check helper -------------------------------------------
-- security definer + explicit search_path: runs with the function owner's
-- privileges so it isn't itself blocked by the RLS policies that call it.
create or replace function public.is_staff_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(p.role) in ('admin', 'hr', 'manager', 'ceo')
  );
$$;

-- 2. Expand profiles policies from "admin only" to the manager group -----
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Managers can view all profiles"
  on public.profiles for select
  using (
    auth.uid() = id
    or public.is_staff_manager()
  );

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Managers can update profiles"
  on public.profiles for update
  using (public.is_staff_manager());

drop policy if exists "Admins can delete profiles" on public.profiles;
create policy "Managers can delete profiles"
  on public.profiles for delete
  using (public.is_staff_manager());

-- 3. Attendance table ------------------------------------------------------
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles(id) on delete cascade,
  -- The client sends its own local calendar date (YYYY-MM-DD) rather than
  -- relying on the database server's timezone, so "today" always matches
  -- the staff member's wall-clock day rather than the DB server's.
  work_date date not null,
  check_in timestamptz,
  check_out timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_id, work_date)
);

create index if not exists attendance_work_date_idx on public.attendance (work_date);
create index if not exists attendance_staff_id_idx on public.attendance (staff_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_attendance_updated_at on public.attendance;
create trigger trg_attendance_updated_at
  before update on public.attendance
  for each row execute function public.set_updated_at();

alter table public.attendance enable row level security;

-- Staff see their own record; admin/hr/manager/ceo see everyone's (this is
-- what powers the live "Today's Attendance" table in staff-management.html).
drop policy if exists "Staff can view own attendance" on public.attendance;
create policy "View own or all attendance"
  on public.attendance for select
  using (auth.uid() = staff_id or public.is_staff_manager());

-- Only the staff member themselves can create their check-in row.
drop policy if exists "Staff can insert own attendance" on public.attendance;
create policy "Insert own attendance"
  on public.attendance for insert
  with check (auth.uid() = staff_id);

-- Staff can update their own row (e.g. checking out); managers can also
-- correct a record if needed.
drop policy if exists "Staff can update own attendance" on public.attendance;
create policy "Update own or any attendance"
  on public.attendance for update
  using (auth.uid() = staff_id or public.is_staff_manager())
  with check (auth.uid() = staff_id or public.is_staff_manager());

-- Enable Realtime on this table so staff-management.html can subscribe to
-- postgres_changes and update the live table without refreshing the page.
-- Wrapped in a DO block because re-adding an already-published table
-- throws an error rather than a no-op.
do $$
begin
  execute 'alter publication supabase_realtime add table public.attendance';
exception when others then
  raise notice 'Realtime publication step skipped (likely already applied): %', sqlerrm;
end $$;

-- 4. Aggregate-only company summary RPC -----------------------------------
-- Returns counts only (never individual attendance rows), so it's safe to
-- grant to every signed-in staff member for their personal dashboard,
-- without exposing who specifically has or hasn't checked in.
create or replace function public.today_attendance_summary(target_date date)
returns table (total_active_staff bigint, checked_in bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.profiles where is_active is not false) as total_active_staff,
    (select count(*) from public.attendance
       where work_date = target_date and check_in is not null) as checked_in;
$$;

grant execute on function public.today_attendance_summary(date) to authenticated;