-- Pauer am Haken (Ulrich Imboden) – Rangliste für Supabase
-- Einmal im Supabase-Projekt «Ranglisten der Spiele» unter "SQL Editor" einfügen und auf "Run" klicken.
-- Das Skript kann gefahrlos mehrmals ausgeführt werden. Die Tabellen der anderen
-- Spiele (iischi_party_…, HORNOX, Schnyder-Game) werden nicht berührt.
--
-- Sicherheit:
-- * Das Spiel darf die Tabelle weder direkt lesen noch direkt beschreiben.
-- * Es ruft nur die zwei Funktionen unten auf.
-- * E-Mail-Adressen verlassen die Datenbank nie. Sichtbar sind sie nur im
--   Supabase-Dashboard (Table Editor -> pauer_am_haken_alle_spiele).

-- Tabelle pauer_am_haken_alle_spiele: jedes gespielte Spiel mit Name, E-Mail, Punkten und Höhe.
create table if not exists public.pauer_am_haken_alle_spiele (
  id          bigint generated always as identity primary key,
  name        text        not null check (char_length(name) between 1 and 24),
  email       text        not null check (char_length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  score       integer     not null check (score between 0 and 350000),
  hoehe       integer     not null default 0 check (hoehe between 0 and 3000),
  stockwerke  integer     not null default 0 check (stockwerke between 0 and 1000),
  perfekt     integer     not null default 0 check (perfekt between 0 and 1000),
  beste_serie integer     not null default 0 check (beste_serie between 0 and 1000),
  created_at  timestamptz not null default now(),
  -- Pro Stockwerk gibt es höchstens 350 Punkte (150 perfekt + 200 Pauer-Bonus).
  constraint pauer_am_haken_punkte_moeglich check (score <= stockwerke * 350 and hoehe = stockwerke * 3)
);

create index if not exists pauer_am_haken_email_idx on public.pauer_am_haken_alle_spiele (lower(email));
create index if not exists pauer_am_haken_score_idx on public.pauer_am_haken_alle_spiele (score desc);

alter table public.pauer_am_haken_alle_spiele enable row level security;
revoke all on table public.pauer_am_haken_alle_spiele from anon, authenticated;

-- Bestenliste: pro Spieler (E-Mail) zählt nur das beste Ergebnis (nach Punkten).
-- Gibt nur Platz, Name, Punkte und Höhe zurück, nie die E-Mail.
create or replace function public.pauer_am_haken_board(p_limit integer default 10)
returns table (rank bigint, name text, score integer, height integer)
language sql
stable
security definer
set search_path = public
as $$
  with best as (
    select distinct on (lower(s.email)) s.name, s.score, s.hoehe, s.created_at
    from public.pauer_am_haken_alle_spiele s
    order by lower(s.email), s.score desc, s.created_at asc
  )
  select rank() over (order by b.score desc) as rank, b.name, b.score, b.hoehe as height
  from best b
  order by b.score desc, b.created_at asc
  limit least(greatest(coalesce(p_limit, 10), 1), 100);
$$;

-- Ergebnis eintragen. Gibt den Platz des Spielers, seine Bestpunktzahl, die Höhe
-- dieses besten Laufs und die Anzahl Spieler auf der Rangliste zurück.
create or replace function public.pauer_am_haken_submit(p_name text, p_email text, p_score integer, p_height integer, p_floors integer, p_perfects integer, p_streak integer)
returns table (rank bigint, best_score integer, best_height integer, total bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name   text := btrim(regexp_replace(coalesce(p_name, ''), '[[:space:]]+', ' ', 'g'));
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_best   integer;
  v_height integer;
begin
  -- Schutz gegen Spam: höchstens 20 Einträge pro E-Mail-Adresse und Stunde.
  if (select count(*) from public.pauer_am_haken_alle_spiele s
      where lower(s.email) = v_email and s.created_at > now() - interval '1 hour') >= 20 then
    raise exception 'too_many_entries' using errcode = 'P0001';
  end if;

  insert into public.pauer_am_haken_alle_spiele (name, email, score, hoehe, stockwerke, perfekt, beste_serie)
  values (v_name, v_email, p_score, coalesce(p_height, 0), coalesce(p_floors, 0), coalesce(p_perfects, 0), coalesce(p_streak, 0));

  select s.score, s.hoehe into v_best, v_height
  from public.pauer_am_haken_alle_spiele s
  where lower(s.email) = v_email
  order by s.score desc, s.created_at asc
  limit 1;

  -- Der zuletzt eingegebene Name gilt für alle Einträge dieses Spielers.
  update public.pauer_am_haken_alle_spiele s set name = v_name where lower(s.email) = v_email and s.name <> v_name;

  return query
    with best as (
      select lower(s.email) as player, max(s.score) as top
      from public.pauer_am_haken_alle_spiele s
      group by lower(s.email)
    )
    select (select count(*) from best where top > v_best) + 1,
           v_best,
           v_height,
           (select count(*) from best);
end;
$$;

-- Übersicht für das Supabase-Dashboard (Table Editor -> pauer_am_haken_rangliste):
-- bestes Ergebnis pro Spieler mit E-Mail, sortiert nach Platz.
-- Nur im Dashboard sichtbar, das Spiel hat keinen Zugriff.
create or replace view public.pauer_am_haken_rangliste with (security_invoker = true) as
  with best as (
    select distinct on (lower(s.email)) s.name, s.email, s.score, s.hoehe, s.stockwerke, s.perfekt, s.beste_serie, s.created_at
    from public.pauer_am_haken_alle_spiele s
    order by lower(s.email), s.score desc, s.created_at asc
  ),
  runs as (
    select lower(s.email) as player, count(*) as laeufe from public.pauer_am_haken_alle_spiele s group by lower(s.email)
  )
  select rank() over (order by b.score desc) as platz,
         b.name, b.email, b.score as punkte, b.hoehe as hoehe_meter, b.stockwerke,
         b.perfekt as perfekte_treffer, b.beste_serie, r.laeufe, b.created_at as datum
  from best b join runs r on r.player = lower(b.email)
  order by b.score desc, b.created_at asc;

revoke all on table public.pauer_am_haken_rangliste from anon, authenticated;
revoke all on function public.pauer_am_haken_board(integer) from public;
revoke all on function public.pauer_am_haken_submit(text, text, integer, integer, integer, integer, integer) from public;
grant execute on function public.pauer_am_haken_board(integer) to anon, authenticated;
grant execute on function public.pauer_am_haken_submit(text, text, integer, integer, integer, integer, integer) to anon, authenticated;
