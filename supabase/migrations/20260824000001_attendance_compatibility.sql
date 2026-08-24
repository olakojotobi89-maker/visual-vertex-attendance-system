-- Compatibility bridge for the already-shipped browser contract.
-- Canonical columns remain staff_id/work_date; legacy aliases are maintained
-- while clients are progressively updated, avoiding destructive renames.
alter table public.attendance add column if not exists user_id uuid;
alter table public.attendance add column if not exists attendance_date date;
update public.attendance set user_id = staff_id, attendance_date = work_date
where user_id is null or attendance_date is null;
alter table public.attendance alter column user_id set not null;
alter table public.attendance alter column attendance_date set not null;
create unique index if not exists attendance_user_date_legacy_idx on public.attendance(user_id, attendance_date);

create or replace function public.sync_attendance_identifiers()
returns trigger language plpgsql as $$
begin
  if new.staff_id is null then new.staff_id := new.user_id; end if;
  if new.user_id is null then new.user_id := new.staff_id; end if;
  if new.work_date is null then new.work_date := new.attendance_date; end if;
  if new.attendance_date is null then new.attendance_date := new.work_date; end if;
  if new.staff_id <> new.user_id or new.work_date <> new.attendance_date then
    raise exception 'Attendance identifiers must agree';
  end if;
  return new;
end; $$;
drop trigger if exists trg_attendance_identifier_sync on public.attendance;
create trigger trg_attendance_identifier_sync before insert or update on public.attendance
for each row execute function public.sync_attendance_identifiers();
