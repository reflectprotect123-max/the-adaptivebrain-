-- Coach lift memory on top of the live project.
-- Working max is e1RM. LAST is the last working load.
-- Warm-up and cool-down do not write. Formula matches
-- packages/brain/src/load.js estimateE1rmKg (Epley, reps clamped at 20,
-- rounded to 0.1 kg). The browser uses that same function; these RPCs
-- keep a signed-in copy. They do not call decideNext.

create or replace function public.estimate_e1rm_kg(load_kg numeric, reps numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when load_kg is null or reps is null or load_kg <= 0 or reps < 1 then 0::numeric
    else round(load_kg * (1 + least(20::numeric, reps) / 30), 1)
  end
$$;

revoke all on function public.estimate_e1rm_kg(numeric, numeric) from public, anon;
grant execute on function public.estimate_e1rm_kg(numeric, numeric) to authenticated;

create table if not exists public.coach_lift_memory (
  athlete_id uuid not null references auth.users (id) on delete cascade,
  exercise_key text not null,
  exercise_id text not null default '',
  exercise_name text not null default '',
  last_kg numeric,
  last_reps numeric,
  last_effort text,
  last_miss boolean not null default false,
  e1rm_kg numeric not null default 0,
  last_pct numeric,
  working_max_source text,
  formula text not null default 'epley',
  updated_at timestamptz not null default now(),
  primary key (athlete_id, exercise_key),
  constraint coach_lift_memory_e1rm_ck check (e1rm_kg >= 0),
  constraint coach_lift_memory_last_ck check (last_kg is null or last_kg >= 0),
  constraint coach_lift_memory_formula_ck check (formula in ('epley', 'brzycki')),
  constraint coach_lift_memory_source_ck check (
    working_max_source is null
    or working_max_source in ('auto_estimate', 'coach_set', 'athlete_set', 'test_result')
  ),
  constraint coach_lift_memory_effort_ck check (
    last_effort is null or last_effort in ('easy', 'medium', 'hard')
  )
);

comment on table public.coach_lift_memory is
  'Per athlete and lift title. e1rm_kg is the working max. last_kg is LAST.';

alter table public.coach_lift_memory enable row level security;

revoke all on public.coach_lift_memory from anon, authenticated;
grant select, insert, update on public.coach_lift_memory to authenticated;

drop policy if exists coach_lift_memory_athlete_select on public.coach_lift_memory;
create policy coach_lift_memory_athlete_select on public.coach_lift_memory
  for select to authenticated
  using (athlete_id = (select auth.uid()));

drop policy if exists coach_lift_memory_coach_select on public.coach_lift_memory;
create policy coach_lift_memory_coach_select on public.coach_lift_memory
  for select to authenticated
  using (public.coaches_athlete_anywhere(athlete_id));

drop policy if exists coach_lift_memory_athlete_insert on public.coach_lift_memory;
create policy coach_lift_memory_athlete_insert on public.coach_lift_memory
  for insert to authenticated
  with check (athlete_id = (select auth.uid()));

drop policy if exists coach_lift_memory_athlete_update on public.coach_lift_memory;
create policy coach_lift_memory_athlete_update on public.coach_lift_memory
  for update to authenticated
  using (athlete_id = (select auth.uid()))
  with check (athlete_id = (select auth.uid()));

drop policy if exists coach_lift_memory_coach_insert on public.coach_lift_memory;
create policy coach_lift_memory_coach_insert on public.coach_lift_memory
  for insert to authenticated
  with check (public.coaches_athlete_anywhere(athlete_id));

drop policy if exists coach_lift_memory_coach_update on public.coach_lift_memory;
create policy coach_lift_memory_coach_update on public.coach_lift_memory
  for update to authenticated
  using (public.coaches_athlete_anywhere(athlete_id))
  with check (public.coaches_athlete_anywhere(athlete_id));

create or replace function public.remember_coach_lift(
  p_athlete uuid,
  p_exercise_key text,
  p_exercise_id text,
  p_name text,
  p_load_kg numeric,
  p_reps numeric,
  p_effort text,
  p_miss boolean,
  p_role text
) returns public.coach_lift_memory
language plpgsql
security invoker
set search_path = ''
as $$
declare
  est numeric := 0;
  existing public.coach_lift_memory;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_athlete is null or coalesce(btrim(p_exercise_key), '') = '' then
    raise exception 'exercise key required';
  end if;
  if p_role in ('warmup', 'cooldown') then
    select * into existing
      from public.coach_lift_memory
      where athlete_id = p_athlete and exercise_key = p_exercise_key;
    return existing;
  end if;
  if coalesce(p_miss, false) = false and p_load_kg > 0 and p_reps >= 1 then
    est := public.estimate_e1rm_kg(p_load_kg, p_reps);
  end if;
  insert into public.coach_lift_memory (
    athlete_id, exercise_key, exercise_id, exercise_name,
    last_kg, last_reps, last_effort, last_miss, e1rm_kg, last_pct,
    working_max_source, formula
  ) values (
    p_athlete,
    p_exercise_key,
    coalesce(p_exercise_id, ''),
    coalesce(nullif(btrim(p_name), ''), p_exercise_key),
    p_load_kg,
    p_reps,
    p_effort,
    coalesce(p_miss, false),
    est,
    case when est > 0 then round((p_load_kg / est) * 1000) / 10 else null end,
    case when est > 0 then 'auto_estimate' else null end,
    'epley'
  )
  on conflict (athlete_id, exercise_key) do update set
    exercise_id = coalesce(nullif(excluded.exercise_id, ''), coach_lift_memory.exercise_id),
    exercise_name = excluded.exercise_name,
    last_kg = excluded.last_kg,
    last_reps = excluded.last_reps,
    last_effort = excluded.last_effort,
    last_miss = excluded.last_miss,
    e1rm_kg = greatest(coach_lift_memory.e1rm_kg, excluded.e1rm_kg),
    last_pct = case
      when excluded.last_miss or excluded.e1rm_kg <= 0 then coach_lift_memory.last_pct
      else round((excluded.last_kg / greatest(coach_lift_memory.e1rm_kg, excluded.e1rm_kg)) * 1000) / 10
    end,
    working_max_source = case
      when greatest(coach_lift_memory.e1rm_kg, excluded.e1rm_kg) > coach_lift_memory.e1rm_kg
        then 'auto_estimate'
      else coach_lift_memory.working_max_source
    end,
    formula = 'epley',
    updated_at = now()
  returning * into existing;
  return existing;
end;
$$;

revoke all on function public.remember_coach_lift(uuid, text, text, text, numeric, numeric, text, boolean, text) from public, anon;
grant execute on function public.remember_coach_lift(uuid, text, text, text, numeric, numeric, text, boolean, text) to authenticated;

create or replace function public.set_coach_working_max(
  p_athlete uuid,
  p_exercise_key text,
  p_exercise_id text,
  p_name text,
  p_e1rm_kg numeric
) returns public.coach_lift_memory
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing public.coach_lift_memory;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_athlete is null or coalesce(btrim(p_exercise_key), '') = '' or p_e1rm_kg is null or p_e1rm_kg <= 0 then
    raise exception 'working max requires a lift and a positive kg';
  end if;
  insert into public.coach_lift_memory (
    athlete_id, exercise_key, exercise_id, exercise_name, e1rm_kg, working_max_source, formula
  ) values (
    p_athlete,
    p_exercise_key,
    coalesce(p_exercise_id, ''),
    coalesce(nullif(btrim(p_name), ''), p_exercise_key),
    round(p_e1rm_kg, 1),
    'coach_set',
    'epley'
  )
  on conflict (athlete_id, exercise_key) do update set
    exercise_id = coalesce(nullif(excluded.exercise_id, ''), coach_lift_memory.exercise_id),
    exercise_name = excluded.exercise_name,
    e1rm_kg = excluded.e1rm_kg,
    working_max_source = 'coach_set',
    formula = 'epley',
    updated_at = now()
  returning * into existing;
  return existing;
end;
$$;

revoke all on function public.set_coach_working_max(uuid, text, text, text, numeric) from public, anon;
grant execute on function public.set_coach_working_max(uuid, text, text, text, numeric) to authenticated;

-- exercise_catalogue and exercise_catalogue_sources already exist on the
-- live project (strengthside 20261018090000, PR 273). This migration does
-- not alter them. Catalogue ids are search keys, not working-max keys.

notify pgrst, 'reload schema';
