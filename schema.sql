-- ============================================================
-- GUtech Student Companion — database schema
-- Run this in Supabase → SQL Editor → New query
-- ============================================================

-- ---------- NOTES ----------
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  body text not null default '',
  course text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notes_user on notes(user_id, updated_at desc);

-- ---------- REMINDERS ----------
create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  due_at timestamptz not null,
  kind text not null default 'general',
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_reminders_user on reminders(user_id, due_at);

-- ============================================================
-- ROW LEVEL SECURITY
-- This is the part that keeps one student's data invisible to
-- every other student. Without it, any logged-in user could
-- read the whole table.
-- ============================================================

alter table notes enable row level security;
alter table reminders enable row level security;

-- NOTES policies
drop policy if exists "own notes select" on notes;
create policy "own notes select" on notes
  for select using (auth.uid() = user_id);

drop policy if exists "own notes insert" on notes;
create policy "own notes insert" on notes
  for insert with check (auth.uid() = user_id);

drop policy if exists "own notes update" on notes;
create policy "own notes update" on notes
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own notes delete" on notes;
create policy "own notes delete" on notes
  for delete using (auth.uid() = user_id);

-- REMINDERS policies
drop policy if exists "own reminders select" on reminders;
create policy "own reminders select" on reminders
  for select using (auth.uid() = user_id);

drop policy if exists "own reminders insert" on reminders;
create policy "own reminders insert" on reminders
  for insert with check (auth.uid() = user_id);

drop policy if exists "own reminders update" on reminders;
create policy "own reminders update" on reminders
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own reminders delete" on reminders;
create policy "own reminders delete" on reminders
  for delete using (auth.uid() = user_id);

-- ---------- keep updated_at fresh on notes ----------
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notes_touch on notes;
create trigger notes_touch before update on notes
  for each row execute function touch_updated_at();

-- ============================================================
-- PROFILES — student ID card (Profile tab)
-- ============================================================
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text default '',
  student_id text default '',
  program text default '',
  intake_year text default '',
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

drop policy if exists "own profile select" on profiles;
create policy "own profile select" on profiles
  for select using (auth.uid() = user_id);

drop policy if exists "own profile insert" on profiles;
create policy "own profile insert" on profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "own profile update" on profiles;
create policy "own profile update" on profiles
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists profiles_touch on profiles;
create trigger profiles_touch before update on profiles
  for each row execute function touch_updated_at();

-- ============================================================
-- GRADES — GPA tracker (Grades tab)
-- ============================================================
create table if not exists grades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course text not null,
  credit_hours numeric not null default 3,
  grade text not null,
  term text default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_grades_user on grades(user_id, created_at desc);

alter table grades enable row level security;

drop policy if exists "own grades select" on grades;
create policy "own grades select" on grades
  for select using (auth.uid() = user_id);

drop policy if exists "own grades insert" on grades;
create policy "own grades insert" on grades
  for insert with check (auth.uid() = user_id);

drop policy if exists "own grades update" on grades;
create policy "own grades update" on grades
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own grades delete" on grades;
create policy "own grades delete" on grades
  for delete using (auth.uid() = user_id);

-- ============================================================
-- ANNOUNCEMENTS — campus news feed (Announcements tab)
-- Read-only from the app: every signed-in student can read every
-- row, nobody can write from the browser. Post new announcements
-- yourself from the Supabase SQL editor (see sample insert below).
-- ============================================================
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  category text not null default 'general', -- general | academic | event | deadline
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_announcements_created on announcements(created_at desc);

alter table announcements enable row level security;

drop policy if exists "announcements select signed in" on announcements;
create policy "announcements select signed in" on announcements
  for select using (auth.role() = 'authenticated');

-- sample rows — delete or edit freely
insert into announcements (title, body, category, pinned) values
  ('Welcome to the new student companion', 'Use the Ask tab for quick questions, and check Announcements here for official updates from GUtech.', 'general', true),
  ('Semester fee payment window opens', 'The payment portal opens next week. Pay before the deadline to avoid a late fee.', 'deadline', false),
  ('Career fair on campus', 'Employers from Muscat and abroad will be on campus. Bring your CV.', 'event', false)
on conflict do nothing;

-- ============================================================
-- CLUBS — student clubs directory (More → Clubs)
-- Read-only from the app, same pattern as announcements: post new
-- clubs yourself from the SQL editor.
-- ============================================================
create table if not exists clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'general', -- sport | tech | arts | music | business | culture | academic | volunteering | general
  description text not null default '',
  created_at timestamptz not null default now()
);

alter table clubs enable row level security;

drop policy if exists "clubs select signed in" on clubs;
create policy "clubs select signed in" on clubs
  for select using (auth.role() = 'authenticated');

insert into clubs (name, category, description) values
  ('Football Club', 'sport', 'Weekly matches and a campus league — all skill levels welcome.'),
  ('Robotics Club', 'tech', 'Design, build and compete with autonomous robots.'),
  ('Photography Club', 'arts', 'Campus photo walks, editing workshops and exhibitions.'),
  ('Music Society', 'music', 'Jam sessions, open mic nights and the end-of-year showcase.'),
  ('Entrepreneurship Club', 'business', 'Pitch practice, startup mentoring and founder talks.'),
  ('Cultural Exchange Club', 'culture', 'Celebrating GUtech''s international student community.'),
  ('Debate Society', 'academic', 'Weekly debates and public speaking practice.'),
  ('Community Outreach', 'volunteering', 'Volunteering days across Muscat and Halban.')
on conflict do nothing;

-- ---------- MEMBERSHIPS — who's joined what ----------
-- Private per student: you can only see, add and remove your own
-- membership rows, never another student's.
create table if not exists club_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (user_id, club_id)
);

create index if not exists idx_memberships_user on club_memberships(user_id);

alter table club_memberships enable row level security;

drop policy if exists "own memberships select" on club_memberships;
create policy "own memberships select" on club_memberships
  for select using (auth.uid() = user_id);

drop policy if exists "own memberships insert" on club_memberships;
create policy "own memberships insert" on club_memberships
  for insert with check (auth.uid() = user_id);

drop policy if exists "own memberships delete" on club_memberships;
create policy "own memberships delete" on club_memberships
  for delete using (auth.uid() = user_id);

-- ============================================================
-- VERIFY: after running, this should return 4 rows per table
-- for notes, reminders, grades and club_memberships; 3 rows for
-- profiles; 1 row each for announcements and clubs
-- ============================================================
-- select tablename, policyname from pg_policies
-- where tablename in ('notes','reminders','profiles','grades','announcements','clubs','club_memberships') order by tablename;
