create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- Config

create or replace function public.cfg_timezone() returns text language sql immutable as $$ select 'Europe/Bucharest' $$;
create or replace function public.cfg_open() returns time language sql immutable as $$ select time '08:00' $$;
create or replace function public.cfg_close() returns time language sql immutable as $$ select time '22:00' $$;
create or replace function public.cfg_slot_minutes() returns int language sql immutable as $$ select 30 $$;
create or replace function public.cfg_weekly_slots() returns int language sql immutable as $$ select 3 $$;
create or replace function public.cfg_unlock_isodow() returns int language sql immutable as $$ select 7 $$;
create or replace function public.cfg_unlock_time() returns time language sql immutable as $$ select time '00:00' $$;
create or replace function public.cfg_retention_days() returns int language sql immutable as $$ select 182 $$;
create or replace function public.cfg_pin_max_attempts() returns int language sql immutable as $$ select 5 $$;
create or replace function public.cfg_pin_lock() returns interval language sql immutable as $$ select interval '15 minutes' $$;
create or replace function public.cfg_pin_max_total() returns int language sql immutable as $$ select 20 $$;

create or replace function public.local_now() returns timestamp
language sql stable as $$ select now() at time zone public.cfg_timezone() $$;

-- Tables

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table public.app_state (
  id boolean primary key default true check (id),
  maintenance boolean not null default false,
  broken_machines text[] not null default '{}',
  updated_at timestamptz not null default now()
);
insert into public.app_state default values;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  machine text not null check (machine in ('masina1', 'masina2')),
  date date not null,
  start_time time not null check (extract(second from start_time) = 0 and extract(minute from start_time)::int % 30 = 0),
  duration int not null check (duration > 0 and duration % 30 = 0 and duration <= 600),
  public_name text not null check (char_length(public_name) <= 40),
  created_at timestamptz not null default now(),
  slot tsrange generated always as (
    tsrange(date + start_time, date + start_time + duration * interval '1 minute')
  ) stored,
  constraint bookings_no_overlap exclude using gist (machine with =, slot with &&)
);
create index bookings_date_idx on public.bookings (date, start_time);
create index bookings_group_idx on public.bookings (group_id);

create table public.booking_private (
  booking_id uuid primary key references public.bookings (id) on delete cascade,
  user_name text not null check (char_length(user_name) between 3 and 60),
  room text not null check (room ~ '^[0-9A-Z]{1,4}$'),
  owner_key text not null
);
create index booking_private_owner_idx on public.booking_private (owner_key);

create table public.booking_secrets (
  group_id uuid primary key,
  pin_hash text not null,
  failed_attempts int not null default 0,
  locked_until timestamptz
);

-- Helpers

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

create or replace function public.public_from() returns date
language sql stable as $$ select (public.local_now())::date - 7 $$;

create or replace function public.trg_cleanup_secret() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.bookings where group_id = old.group_id) then
    delete from public.booking_secrets where group_id = old.group_id;
  end if;
  return null;
end $$;

create trigger bookings_cleanup_secret after delete on public.bookings
  for each row execute function public.trg_cleanup_secret();

-- Access

alter table public.admins enable row level security;
alter table public.app_state enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_private enable row level security;
alter table public.booking_secrets enable row level security;

revoke all on public.admins, public.booking_private, public.booking_secrets from anon;
revoke all on public.booking_secrets from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.admins, public.booking_private from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.app_state from anon;
revoke insert, delete, truncate, references, trigger on public.app_state from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.bookings from anon;
revoke insert, update, truncate, references, trigger on public.bookings from authenticated;

create policy admins_self_read on public.admins for select to authenticated
  using (user_id = (select auth.uid()));

create policy app_state_read on public.app_state for select to anon, authenticated using (true);
create policy app_state_admin on public.app_state for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy bookings_read on public.bookings for select to anon, authenticated
  using (date >= public.public_from() or (select public.is_admin()));
create policy bookings_admin_delete on public.bookings for delete to authenticated
  using ((select public.is_admin()));

create policy booking_private_admin_read on public.booking_private for select to authenticated
  using ((select public.is_admin()));

create view public.admin_bookings with (security_invoker = true) as
  select b.id, b.group_id, b.machine, b.date, b.start_time, b.duration, b.created_at, p.user_name, p.room
  from public.bookings b
  join public.booking_private p on p.booking_id = b.id;
revoke all on public.admin_bookings from anon, authenticated;
grant select on public.admin_bookings to authenticated;

-- Booking

create or replace function public.book(
  p_user_name text, p_room text, p_pin text,
  p_machines text[], p_date date, p_start time, p_duration int
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamp := public.local_now();
  v_today date := v_now::date;
  v_slot int := public.cfg_slot_minutes();
  v_name text;
  v_room text;
  v_key text;
  v_public text;
  v_machines text[];
  v_state public.app_state;
  v_isodow int;
  v_last date;
  v_mon date;
  v_used int;
  v_group uuid := gen_random_uuid();
  v_id uuid;
  m text;
begin
  v_name := initcap(regexp_replace(btrim(coalesce(p_user_name, '')), '\s+', ' ', 'g'));
  v_room := upper(btrim(coalesce(p_room, '')));
  if char_length(v_name) < 3 or char_length(v_name) > 60 then raise exception 'short_name_err'; end if;
  if v_room !~ '^[0-9A-Z]{1,4}$' then raise exception 'room_err'; end if;
  if coalesce(p_pin, '') !~ '^\d{4}$' then raise exception 'pin_4_digits_err'; end if;

  select array_agg(distinct x) into v_machines from unnest(p_machines) x;
  if v_machines is null or not v_machines <@ array['masina1', 'masina2'] then raise exception 'choose_machine_err'; end if;

  select * into v_state from public.app_state;
  if v_state.maintenance then raise exception 'maintenance'; end if;
  if v_machines && v_state.broken_machines then raise exception 'machine_broken_err'; end if;

  if p_date is null or p_start is null or p_duration is null then raise exception 'select_time_err'; end if;
  if extract(second from p_start) <> 0
     or (extract(hour from p_start)::int * 60 + extract(minute from p_start)::int) % v_slot <> 0
     or p_duration <= 0 or p_duration % v_slot <> 0 then
    raise exception 'half_hour_err';
  end if;
  if p_start < public.cfg_open()
     or p_duration > extract(epoch from public.cfg_close() - p_start) / 60 then
    raise exception 'outside_hours_err';
  end if;
  if p_date < v_today or (p_date = v_today and p_start + p_duration * interval '1 minute' <= v_now::time) then
    raise exception 'past_time_err';
  end if;

  v_isodow := extract(isodow from v_today)::int;
  v_last := v_today + (7 - v_isodow);
  if v_isodow > public.cfg_unlock_isodow()
     or (v_isodow = public.cfg_unlock_isodow() and v_now::time >= public.cfg_unlock_time()) then
    v_last := v_last + 7;
  end if;
  if p_date > v_last then raise exception 'week_locked_toast'; end if;

  v_key := lower(v_name) || '|' || v_room;
  v_mon := p_date - (extract(isodow from p_date)::int - 1);
  perform pg_advisory_xact_lock(hashtextextended(v_key || '@' || v_mon::text, 0));

  select count(distinct (b.date, b.start_time + s * v_slot * interval '1 minute')) into v_used
  from public.bookings b
  join public.booking_private p on p.booking_id = b.id
  cross join lateral generate_series(0, b.duration / v_slot - 1) s
  where p.owner_key = v_key and b.date between v_mon and v_mon + 6;

  if v_used + p_duration / v_slot > public.cfg_weekly_slots() then
    raise exception 'weekly_limit_err' using detail = greatest(0, public.cfg_weekly_slots() - v_used)::text;
  end if;

  v_public := split_part(v_name, ' ', 1)
    || case when position(' ' in v_name) > 0 then ' ' || left(regexp_replace(v_name, '^.* ', ''), 1) || '.' else '' end
    || ' · ' || v_room;

  insert into public.booking_secrets (group_id, pin_hash)
  values (v_group, extensions.crypt(p_pin, extensions.gen_salt('bf', 8)));

  foreach m in array v_machines loop
    insert into public.bookings (group_id, machine, date, start_time, duration, public_name)
    values (v_group, m, p_date, p_start, p_duration, v_public)
    returning id into v_id;
    insert into public.booking_private (booking_id, user_name, room, owner_key)
    values (v_id, v_name, v_room, v_key);
  end loop;

  return v_group;
exception
  when exclusion_violation then raise exception 'slot_taken_err';
end $$;

-- Cancel

create or replace function public.cancel_booking(p_booking_id uuid, p_pin text)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_group uuid;
  v_sec public.booking_secrets;
  v_fails int;
begin
  select group_id into v_group from public.bookings where id = p_booking_id;
  if not found then return 'not_found'; end if;

  select * into v_sec from public.booking_secrets where group_id = v_group for update;
  if not found then return 'not_found'; end if;
  if v_sec.locked_until > now() then return 'locked'; end if;

  if coalesce(p_pin, '') !~ '^\d{4}$' or extensions.crypt(p_pin, v_sec.pin_hash) <> v_sec.pin_hash then
    v_fails := v_sec.failed_attempts + 1;
    update public.booking_secrets
    set failed_attempts = v_fails,
        locked_until = case
          when v_fails >= public.cfg_pin_max_total() then 'infinity'
          when v_fails % public.cfg_pin_max_attempts() = 0
            then now() + public.cfg_pin_lock() * power(2, v_fails / public.cfg_pin_max_attempts() - 1)
          else locked_until
        end
    where group_id = v_group;
    return 'wrong_pin';
  end if;

  update public.booking_secrets set failed_attempts = 0, locked_until = null where group_id = v_group;
  delete from public.bookings where id = p_booking_id;
  return 'ok';
end $$;

-- Retention

create or replace function public.purge_old_bookings() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  delete from public.bookings where date < (public.local_now())::date - public.cfg_retention_days();
  get diagnostics n = row_count;
  return n;
end $$;

-- Grants

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.book(text, text, text, text[], date, time, int) to anon, authenticated;
grant execute on function public.cancel_booking(uuid, text) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.public_from() to anon, authenticated;
grant execute on function public.local_now() to anon, authenticated;
grant execute on function public.cfg_timezone() to anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- Realtime

alter publication supabase_realtime add table public.bookings, public.app_state;

-- Schedule

create extension if not exists pg_cron;
select cron.schedule('purge-old-bookings', '15 3 * * *', $$select public.purge_old_bookings()$$);
