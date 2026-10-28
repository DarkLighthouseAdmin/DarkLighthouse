-- Famstamp v88 booking forwarding ("email us your booking"). ADDITIVE ONLY: 3 new tables, 1 index, RLS on (no direct table
-- access), 4 new functions, grants. No DROP / DELETE / TRUNCATE / ALTER of existing objects. Safe to run more than once.
-- Needs the existing helpers public.is_member(uuid) (family_sync migration).
-- How it works: a family forwards a flight or hotel confirmation to trips+CODE@darklighthousesolutions.com (CODE is the family's
-- 6-letter forwarding code), or to trips@ from the email address a family member signed in with. A small Google Apps Script on
-- the domain's mailbox reads it with booking-core.js and calls ingest_booking() with ONLY the parsed places, dates and hotel
-- name (never the email itself, names, confirmation numbers or prices). The family sees it in the app as a draft trip to confirm.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.family_mail_codes (
  family_id  uuid primary key references public.families(id) on delete cascade,
  code       text not null unique check (code ~ '^[a-hjkmnp-z2-9]{6}$'),
  created_at timestamptz not null default now()
);
create table if not exists public.booking_inbox (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  parsed      jsonb not null check (jsonb_typeof(parsed) = 'object' and octet_length(parsed::text) <= 4000),
  matched_by  text not null check (matched_by in ('code', 'sender')),
  received_at timestamptz not null default now(),
  status      text not null default 'new' check (status in ('new', 'used', 'dismissed')),
  handled_at  timestamptz
);
create index if not exists booking_inbox_family_idx on public.booking_inbox (family_id, status, received_at desc);
-- private settings (only the hash of the mail script's secret lives here)
create table if not exists public.fs_private_settings (key text primary key, value text not null);
alter table public.family_mail_codes enable row level security;
alter table public.booking_inbox enable row level security;
alter table public.fs_private_settings enable row level security;
-- no policies on purpose: nobody reads or writes these tables directly; the functions below do (security definer)
revoke all on public.family_mail_codes, public.booking_inbox, public.fs_private_settings from anon, authenticated;

insert into public.fs_private_settings (key, value) values ('mail_ingest_sha256', '__SECRET_SHA256__') on conflict (key) do nothing;

-- The family's forwarding code (made the first time a member asks). Members only.
create or replace function public.my_booking_address(p_family uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v text; i int := 0;
begin
  if not public.is_member(p_family) then raise exception 'Not in this family' using errcode = '42501'; end if;
  select code into v from family_mail_codes where family_id = p_family;
  if v is not null then return v; end if;
  loop
    v := (select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', 1 + (get_byte(b, n) % 31), 1), '' order by n)
          from (select gen_random_bytes(6) b) r, generate_series(0, 5) n);
    exit when not exists (select 1 from family_mail_codes x where x.code = v);
    i := i + 1; if i > 20 then raise exception 'Try again'; end if;
  end loop;
  insert into family_mail_codes (family_id, code) values (p_family, v) on conflict (family_id) do nothing;
  return (select code from family_mail_codes where family_id = p_family);
end $$;

-- Bookings waiting for this family to confirm (last 30 days). Members only.
create or replace function public.booking_inbox_list(p_family uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_member(p_family) then raise exception 'Not in this family' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'parsed', b.parsed, 'received_at', b.received_at) order by b.received_at desc)
    from booking_inbox b where b.family_id = p_family and b.status = 'new' and b.received_at > now() - interval '30 days'), '[]'::jsonb);
end $$;

-- Mark one as made into a trip ('used') or not wanted ('dismissed'). Members only. Rows are kept (no deletes).
create or replace function public.booking_inbox_mark(p_id uuid, p_status text) returns boolean
language plpgsql security definer set search_path = public as $$
declare f uuid;
begin
  if p_status not in ('used', 'dismissed') then raise exception 'Bad status'; end if;
  select family_id into f from booking_inbox where id = p_id;
  if f is null or not public.is_member(f) then raise exception 'Not in this family' using errcode = '42501'; end if;
  update booking_inbox set status = p_status, handled_at = now() where id = p_id and status = 'new';
  return found;
end $$;

-- Called by the mail script only (it knows the secret). Keeps only well-formed places/dates/hotel names.
-- Returns 'code' or 'sender' (how it matched), 'nomatch', 'empty' or 'limit'.
create or replace function public.ingest_booking(p_secret text, p_code text, p_sender text, p_parsed jsonb) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare f uuid; how text; n int; fl jsonb; ho jsonb; ok_secret boolean;
begin
  select value = encode(digest(coalesce(p_secret, ''), 'sha256'), 'hex') into ok_secret from fs_private_settings where key = 'mail_ingest_sha256';
  if not coalesce(ok_secret, false) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_code ~ '^[a-hjkmnp-z2-9]{6}$' then select family_id into f from family_mail_codes where code = lower(p_code); how := 'code'; end if;
  if f is null and p_sender ~* '^[^@\s]{1,64}@[^@\s]{1,255}$' then
    select min(m.family_id::text)::uuid, count(distinct m.family_id) into f, n
      from family_members m join auth.users u on u.id = m.user_id where lower(u.email) = lower(p_sender);
    if n <> 1 then f := null; end if;   -- in no family, or in several: we can't tell which, so ask them to use the code address
    how := 'sender';
  end if;
  if f is null then return 'nomatch'; end if;
  if (select count(*) from booking_inbox b where b.family_id = f and b.received_at > now() - interval '1 day') >= 30 then return 'limit'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('dep', x->>'dep', 'arr', x->>'arr', 'date', case when x->>'date' ~ '^\d{4}-\d{2}-\d{2}$' then x->>'date' end)), '[]'::jsonb) into fl
    from (select x from jsonb_array_elements(case when jsonb_typeof(p_parsed->'flights') = 'array' then p_parsed->'flights' else '[]'::jsonb end) x
          where x->>'dep' ~ '^[A-Z]{3}$' and x->>'arr' ~ '^[A-Z]{3}$' limit 12) s;
  select coalesce(jsonb_agg(jsonb_build_object('name', left(x->>'name', 80), 'city', left(coalesce(x->>'city', ''), 60),
      'checkIn', case when x->>'checkIn' ~ '^\d{4}-\d{2}-\d{2}$' then x->>'checkIn' end,
      'checkOut', case when x->>'checkOut' ~ '^\d{4}-\d{2}-\d{2}$' then x->>'checkOut' end,
      'nights', case when x->>'nights' ~ '^\d{1,3}$' then (x->>'nights')::int end)), '[]'::jsonb) into ho
    from (select x from jsonb_array_elements(case when jsonb_typeof(p_parsed->'hotels') = 'array' then p_parsed->'hotels' else '[]'::jsonb end) x
          where coalesce(x->>'name', '') <> '' limit 6) s;
  if jsonb_array_length(fl) = 0 and jsonb_array_length(ho) = 0 then return 'empty'; end if;
  insert into booking_inbox (family_id, parsed, matched_by) values (f, jsonb_build_object('flights', fl, 'hotels', ho), how);
  return how;
end $$;

revoke all on function public.my_booking_address(uuid), public.booking_inbox_list(uuid), public.booking_inbox_mark(uuid, text),
  public.ingest_booking(text, text, text, jsonb) from public;
grant execute on function public.my_booking_address(uuid), public.booking_inbox_list(uuid), public.booking_inbox_mark(uuid, text) to authenticated;
grant execute on function public.ingest_booking(text, text, text, jsonb) to anon, authenticated;
