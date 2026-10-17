-- Coach publish → athlete calendar via assigned_session (this repo owns the table).
-- Adds coach INSERT/UPDATE when coaches_athlete_anywhere, plus 'unpublished' state
-- so Publish/Unpublish matches the coach calendar without thawing frozen snapshots.

-- Expand state machine: unpublished = was live, now hidden from athlete pull.
alter table public.assigned_session
  drop constraint if exists assigned_session_state_ck;

alter table public.assigned_session
  add constraint assigned_session_state_ck
  check (state in (
    'draft',
    'published',
    'unpublished',
    'in_progress',
    'completed',
    'skipped'
  ));

-- Soft identity for HTML coach sessions (local ses_* ids are not uuids).
alter table public.assigned_session
  add column if not exists coach_session_key text;

-- Multiple null keys allowed (legacy athlete-created rows); coach publishes set a key.
create unique index if not exists assigned_session_athlete_coach_key_uidx
  on public.assigned_session (athlete_id, coach_session_key)
  where coach_session_key is not null;

comment on column public.assigned_session.coach_session_key is
  'Stable key from coach HTML session id; used for idempotent publish upsert.';

comment on column public.assigned_session.resolved_snapshot is
  'Publish-time payload. HTML coach stores { v, htmlSession, nutrition? }.';

-- Coach may insert/update rows for athletes they coach (same helper RLS already uses).
drop policy if exists assigned_session_coach_insert on public.assigned_session;
create policy assigned_session_coach_insert on public.assigned_session
  for insert to authenticated
  with check (public.coaches_athlete_anywhere(athlete_id));

drop policy if exists assigned_session_coach_update on public.assigned_session;
create policy assigned_session_coach_update on public.assigned_session
  for update to authenticated
  using (public.coaches_athlete_anywhere(athlete_id))
  with check (public.coaches_athlete_anywhere(athlete_id));

-- Freeze: unpublished is allowed from published; returning to draft still blocked.
-- Snapshot stays immutable once it has left draft (including unpublished).
create or replace function public.enforce_assigned_session_freeze() returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if old.state <> 'draft' then
    if new.resolved_snapshot is distinct from old.resolved_snapshot then
      raise exception 'resolved_snapshot is frozen once the session is published';
    end if;
    if new.published_at is distinct from old.published_at then
      raise exception 'published_at is frozen once the session is published';
    end if;
    if new.state = 'draft' then
      raise exception 'a published session cannot return to draft';
    end if;
  end if;
  return new;
end;
$fn$;
