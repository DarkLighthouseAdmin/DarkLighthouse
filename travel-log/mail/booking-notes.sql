-- Famstamp v92: "we got your email but couldn't read it" notes for booking forwarding. ADDITIVE ONLY: 1 new table, 1 index,
-- RLS on (no direct table access), 4 new functions, grants. Does not change booking_inbox, ingest_booking or any existing object.
-- No DROP / DELETE / TRUNCATE. Safe to run more than once. Needs booking-inbox.sql (v88) to have been run first.
-- Stored per note: when the email arrived, the sender's DOMAIN only (e.g. united.com), the subject cut to 60 characters, and why
-- it couldn't be used ('unreadable' or 'limit'). Never the email itself, the sender's address, names, numbers or prices.

create table if not exists public.booking_mail_notes (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references public.families(id) on delete cascade,
  received_at    timestamptz not null default now(),
  sender_domain  text not null default '' check (char_length(sender_domain) <= 100),
  subject        text not null default '' check (char_length(subject) <= 60),
  reason         text not null check (reason in ('unreadable', 'limit')),
  status         text not null default 'new' check (status in ('new', 'seen')),
  created_at     timestamptz not null default now(),
  seen_at        timestamptz
);
create index if not exists booking_mail_notes_family_idx on public.booking_mail_notes (family_id, status, received_at desc);
alter table public.booking_mail_notes enable row level security;
-- no policies on purpose: only the functions below (security definer) read or write it
revoke all on public.booking_mail_notes from anon, authenticated;

-- Which family a forwarded email belongs to: the trips+CODE@ code, else the sender's sign-in email when it is in exactly one family.
create or replace function public.fs_mail_family(p_code text, p_sender text) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare f uuid; n int;
begin
  if p_code ~ '^[a-hjkmnp-z2-9]{6}$' then select family_id into f from family_mail_codes where code = lower(p_code); end if;
  if f is null and p_sender ~* '^[^@\s]{1,64}@[^@\s]{1,255}$' then
    select min(m.family_id::text)::uuid, count(distinct m.family_id) into f, n
      from family_members m join auth.users u on u.id = m.user_id where lower(u.email) = lower(p_sender);
    if n <> 1 then f := null; end if;
  end if;
  return f;
end $$;

-- Called by the mail script only (it knows the secret) when a forwarded email to a family couldn't be used.
-- Returns 'noted', 'nomatch', 'skip' (a note like it already waits, or the family's 10-a-day note cap is reached).
create or replace function public.note_booking_failed(p_secret text, p_code text, p_sender text, p_subject text, p_reason text, p_received timestamptz)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare f uuid; ok_secret boolean; dom text; subj text; rcv timestamptz;
begin
  select value = encode(digest(coalesce(p_secret, ''), 'sha256'), 'hex') into ok_secret from fs_private_settings where key = 'mail_ingest_sha256';
  if not coalesce(ok_secret, false) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_reason not in ('unreadable', 'limit') then raise exception 'Bad reason'; end if;
  f := public.fs_mail_family(p_code, p_sender);
  if f is null then return 'nomatch'; end if;
  rcv := least(greatest(coalesce(p_received, now()), now() - interval '30 days'), now());
  dom := lower(coalesce(substring(p_sender from '@([A-Za-z0-9.-]{1,100})$'), ''));
  subj := left(btrim(regexp_replace(coalesce(p_subject, ''), '[[:cntrl:]]+', ' ', 'g')), 60);
  if (select count(*) from booking_mail_notes b where b.family_id = f and b.created_at > now() - interval '1 day') >= 10 then return 'skip'; end if;
  -- the daily-limit note only once a day per family
  if p_reason = 'limit' and exists (select 1 from booking_mail_notes b where b.family_id = f and b.reason = 'limit' and b.created_at > now() - interval '1 day') then return 'skip'; end if;
  insert into booking_mail_notes (family_id, received_at, sender_domain, subject, reason) values (f, rcv, dom, subj, p_reason);
  return 'noted';
end $$;

-- Notes waiting for this family (last 14 days, not yet seen). Members only.
create or replace function public.booking_notes_list(p_family uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_member(p_family) then raise exception 'Not in this family' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'received_at', b.received_at, 'sender_domain', b.sender_domain, 'subject', b.subject, 'reason', b.reason) order by b.received_at desc)
    from booking_mail_notes b where b.family_id = p_family and b.status = 'new' and b.received_at > now() - interval '14 days'), '[]'::jsonb);
end $$;

-- "Got it": mark one note seen. Members only. Rows are kept (no deletes).
create or replace function public.booking_note_seen(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare f uuid;
begin
  select family_id into f from booking_mail_notes where id = p_id;
  if f is null or not public.is_member(f) then raise exception 'Not in this family' using errcode = '42501'; end if;
  update booking_mail_notes set status = 'seen', seen_at = now() where id = p_id and status = 'new';
  return found;
end $$;

revoke all on function public.fs_mail_family(text, text), public.note_booking_failed(text, text, text, text, text, timestamptz),
  public.booking_notes_list(uuid), public.booking_note_seen(uuid) from public;
grant execute on function public.booking_notes_list(uuid), public.booking_note_seen(uuid) to authenticated;
grant execute on function public.note_booking_failed(text, text, text, text, text, timestamptz) to anon, authenticated;
