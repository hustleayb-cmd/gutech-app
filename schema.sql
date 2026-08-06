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
-- full_name/student_id/program are a snapshot of the profile at the
-- moment they joined — this one table answers "who's in club X and
-- what's their student ID" per club_id, no per-club table needed.
create table if not exists club_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  full_name text not null default '',
  student_id text not null default '',
  program text not null default '',
  joined_at timestamptz not null default now(),
  unique (user_id, club_id)
);

-- safe to re-run on a database that already has the table from before
-- these columns existed
alter table club_memberships add column if not exists full_name text not null default '';
alter table club_memberships add column if not exists student_id text not null default '';
alter table club_memberships add column if not exists program text not null default '';

create index if not exists idx_memberships_user on club_memberships(user_id);
create index if not exists idx_memberships_club on club_memberships(club_id);

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
-- PROJECT ROOMS — collaborative group workspace (More → Projects)
-- The one place in this app where data is shared among several
-- students (room members) instead of private to one user. Membership
-- checks go through a security-definer helper function so policies on
-- room_members don't recursively re-trigger RLS on itself.
-- ============================================================

create table if not exists project_rooms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  due_date date,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references project_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'Member',
  color_index int not null default 0,
  status text not null default 'accepted', -- accepted | pending — invite flow lands in a later phase
  joined_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create index if not exists idx_room_members_room on room_members(room_id);
create index if not exists idx_room_members_user on room_members(user_id);

create or replace function public.is_room_member(target_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from room_members
    where room_id = target_room_id and user_id = auth.uid() and status = 'accepted'
  );
$$;

-- Auto-add the creator as the room's first member (role: Lead) the
-- moment a room is created — keeps client code from needing two
-- separate inserts that could fail independently.
create or replace function public.add_room_creator_as_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into room_members (room_id, user_id, role, status)
  values (new.id, new.created_by, 'Lead', 'accepted')
  on conflict (room_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists project_rooms_add_creator on project_rooms;
create trigger project_rooms_add_creator after insert on project_rooms
  for each row execute function public.add_room_creator_as_member();

create table if not exists project_tasks (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references project_rooms(id) on delete cascade,
  title text not null,
  description text not null default '',
  column_name text not null default 'backlog', -- backlog | todo | in_progress | review | done
  assignee_id uuid references auth.users(id) on delete set null,
  priority_flag boolean not null default false,
  due_date date,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_tasks_room on project_tasks(room_id);

create table if not exists task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references project_tasks(id) on delete cascade,
  title text not null,
  is_complete boolean not null default false,
  position int not null default 0
);

create index if not exists idx_checklist_task on task_checklist_items(task_id);

create table if not exists task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references project_tasks(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_comments_task on task_comments(task_id);

create table if not exists room_activity (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references project_rooms(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  detail text default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_room on room_activity(room_id, created_at desc);

alter table project_rooms enable row level security;
alter table room_members enable row level security;
alter table project_tasks enable row level security;
alter table task_checklist_items enable row level security;
alter table task_comments enable row level security;
alter table room_activity enable row level security;

-- project_rooms
drop policy if exists "room members can view room" on project_rooms;
create policy "room members can view room" on project_rooms
  for select using (public.is_room_member(id));
drop policy if exists "authenticated users can create rooms" on project_rooms;
create policy "authenticated users can create rooms" on project_rooms
  for insert with check (auth.uid() = created_by);
drop policy if exists "creator can update room" on project_rooms;
create policy "creator can update room" on project_rooms
  for update using (auth.uid() = created_by) with check (auth.uid() = created_by);
drop policy if exists "creator can delete room" on project_rooms;
create policy "creator can delete room" on project_rooms
  for delete using (auth.uid() = created_by);

-- room_members
drop policy if exists "room members can view membership" on room_members;
create policy "room members can view membership" on room_members
  for select using (public.is_room_member(room_id));
drop policy if exists "user can insert own membership" on room_members;
create policy "user can insert own membership" on room_members
  for insert with check (auth.uid() = user_id);
drop policy if exists "user can update own membership" on room_members;
create policy "user can update own membership" on room_members
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "user can leave room" on room_members;
create policy "user can leave room" on room_members
  for delete using (auth.uid() = user_id);

-- project_tasks
drop policy if exists "room members can view tasks" on project_tasks;
create policy "room members can view tasks" on project_tasks
  for select using (public.is_room_member(room_id));
drop policy if exists "room members can insert tasks" on project_tasks;
create policy "room members can insert tasks" on project_tasks
  for insert with check (public.is_room_member(room_id));
drop policy if exists "room members can update tasks" on project_tasks;
create policy "room members can update tasks" on project_tasks
  for update using (public.is_room_member(room_id)) with check (public.is_room_member(room_id));
drop policy if exists "room members can delete tasks" on project_tasks;
create policy "room members can delete tasks" on project_tasks
  for delete using (public.is_room_member(room_id));

-- task_checklist_items (membership checked via the parent task's room)
drop policy if exists "room members can view checklist" on task_checklist_items;
create policy "room members can view checklist" on task_checklist_items
  for select using (exists (select 1 from project_tasks t where t.id = task_id and public.is_room_member(t.room_id)));
drop policy if exists "room members can insert checklist" on task_checklist_items;
create policy "room members can insert checklist" on task_checklist_items
  for insert with check (exists (select 1 from project_tasks t where t.id = task_id and public.is_room_member(t.room_id)));
drop policy if exists "room members can update checklist" on task_checklist_items;
create policy "room members can update checklist" on task_checklist_items
  for update using (exists (select 1 from project_tasks t where t.id = task_id and public.is_room_member(t.room_id)));
drop policy if exists "room members can delete checklist" on task_checklist_items;
create policy "room members can delete checklist" on task_checklist_items
  for delete using (exists (select 1 from project_tasks t where t.id = task_id and public.is_room_member(t.room_id)));

-- task_comments
drop policy if exists "room members can view comments" on task_comments;
create policy "room members can view comments" on task_comments
  for select using (exists (select 1 from project_tasks t where t.id = task_id and public.is_room_member(t.room_id)));
drop policy if exists "room members can insert comments" on task_comments;
create policy "room members can insert comments" on task_comments
  for insert with check (auth.uid() = author_id and exists (select 1 from project_tasks t where t.id = task_id and public.is_room_member(t.room_id)));

-- room_activity
drop policy if exists "room members can view activity" on room_activity;
create policy "room members can view activity" on room_activity
  for select using (public.is_room_member(room_id));
drop policy if exists "room members can log activity" on room_activity;
create policy "room members can log activity" on room_activity
  for insert with check (public.is_room_member(room_id));

-- ============================================================
-- COURSE PLANNER — AI topic breakdown + spaced review (More →
-- Course Planner). Private per student, unlike Project Rooms.
-- The OpenAI/Google Docs calls happen server-side in a Supabase
-- Edge Function (supabase/functions/course-planner) — the app
-- never calls those APIs directly from the browser.
-- ============================================================

create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_courses_user on courses(user_id);

create table if not exists course_materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  source_link text not null,
  extracted_content text not null default '',
  last_synced_at timestamptz
);

create index if not exists idx_materials_course on course_materials(course_id);

create table if not exists course_topics (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  title text not null,
  summary text not null default '',
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_topics_course on course_topics(course_id, position);

-- confidence_rating stays null until the student actually rates the
-- item — that's what distinguishes "not reviewed" from "rated 0".
create table if not exists course_checklist_items (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references course_topics(id) on delete cascade,
  title text not null,
  position int not null default 0,
  confidence_rating int,
  last_reviewed_at timestamptz,
  next_review_due timestamptz
);

create index if not exists idx_checklist_topic on course_checklist_items(topic_id);

create table if not exists course_chat_messages (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references course_topics(id) on delete cascade,
  checklist_item_id uuid references course_checklist_items(id) on delete cascade,
  role text not null, -- user | assistant
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_topic on course_chat_messages(topic_id, created_at);

alter table courses enable row level security;
alter table course_materials enable row level security;
alter table course_topics enable row level security;
alter table course_checklist_items enable row level security;
alter table course_chat_messages enable row level security;

-- courses
drop policy if exists "own courses select" on courses;
create policy "own courses select" on courses for select using (auth.uid() = user_id);
drop policy if exists "own courses insert" on courses;
create policy "own courses insert" on courses for insert with check (auth.uid() = user_id);
drop policy if exists "own courses update" on courses;
create policy "own courses update" on courses for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own courses delete" on courses;
create policy "own courses delete" on courses for delete using (auth.uid() = user_id);

-- course_materials (reached via the parent course's owner)
drop policy if exists "own materials select" on course_materials;
create policy "own materials select" on course_materials for select
  using (exists (select 1 from courses c where c.id = course_id and c.user_id = auth.uid()));
drop policy if exists "own materials insert" on course_materials;
create policy "own materials insert" on course_materials for insert
  with check (exists (select 1 from courses c where c.id = course_id and c.user_id = auth.uid()));
drop policy if exists "own materials update" on course_materials;
create policy "own materials update" on course_materials for update
  using (exists (select 1 from courses c where c.id = course_id and c.user_id = auth.uid()));
drop policy if exists "own materials delete" on course_materials;
create policy "own materials delete" on course_materials for delete
  using (exists (select 1 from courses c where c.id = course_id and c.user_id = auth.uid()));

-- course_topics
drop policy if exists "own topics select" on course_topics;
create policy "own topics select" on course_topics for select
  using (exists (select 1 from courses c where c.id = course_id and c.user_id = auth.uid()));
drop policy if exists "own topics insert" on course_topics;
create policy "own topics insert" on course_topics for insert
  with check (exists (select 1 from courses c where c.id = course_id and c.user_id = auth.uid()));
drop policy if exists "own topics update" on course_topics;
create policy "own topics update" on course_topics for update
  using (exists (select 1 from courses c where c.id = course_id and c.user_id = auth.uid()));
drop policy if exists "own topics delete" on course_topics;
create policy "own topics delete" on course_topics for delete
  using (exists (select 1 from courses c where c.id = course_id and c.user_id = auth.uid()));

-- course_checklist_items (reached via topic → course → owner)
drop policy if exists "own checklist select" on course_checklist_items;
create policy "own checklist select" on course_checklist_items for select
  using (exists (select 1 from course_topics t join courses c on c.id = t.course_id where t.id = topic_id and c.user_id = auth.uid()));
drop policy if exists "own checklist insert" on course_checklist_items;
create policy "own checklist insert" on course_checklist_items for insert
  with check (exists (select 1 from course_topics t join courses c on c.id = t.course_id where t.id = topic_id and c.user_id = auth.uid()));
drop policy if exists "own checklist update" on course_checklist_items;
create policy "own checklist update" on course_checklist_items for update
  using (exists (select 1 from course_topics t join courses c on c.id = t.course_id where t.id = topic_id and c.user_id = auth.uid()));
drop policy if exists "own checklist delete" on course_checklist_items;
create policy "own checklist delete" on course_checklist_items for delete
  using (exists (select 1 from course_topics t join courses c on c.id = t.course_id where t.id = topic_id and c.user_id = auth.uid()));

-- course_chat_messages
drop policy if exists "own chat select" on course_chat_messages;
create policy "own chat select" on course_chat_messages for select
  using (exists (select 1 from course_topics t join courses c on c.id = t.course_id where t.id = topic_id and c.user_id = auth.uid()));
drop policy if exists "own chat insert" on course_chat_messages;
create policy "own chat insert" on course_chat_messages for insert
  with check (exists (select 1 from course_topics t join courses c on c.id = t.course_id where t.id = topic_id and c.user_id = auth.uid()));

-- ============================================================
-- STREAKS & NOTIFICATION PREFS — cross-cutting, app-wide (not
-- specific to Course Planner). "Never miss twice" model: missing
-- one day doesn't break the streak, missing two in a row does. The
-- actual day-gap math lives in the client (src/lib/streak.js) —
-- this table just holds the current state.
-- ============================================================

create table if not exists user_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_streak int not null default 0,
  last_active_date date,
  updated_at timestamptz not null default now()
);

create table if not exists notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  review_reminders boolean not null default true
);

alter table user_streaks enable row level security;
alter table notification_preferences enable row level security;

drop policy if exists "own streak select" on user_streaks;
create policy "own streak select" on user_streaks for select using (auth.uid() = user_id);
drop policy if exists "own streak upsert" on user_streaks;
create policy "own streak upsert" on user_streaks for insert with check (auth.uid() = user_id);
drop policy if exists "own streak update" on user_streaks;
create policy "own streak update" on user_streaks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own notif prefs select" on notification_preferences;
create policy "own notif prefs select" on notification_preferences for select using (auth.uid() = user_id);
drop policy if exists "own notif prefs upsert" on notification_preferences;
create policy "own notif prefs upsert" on notification_preferences for insert with check (auth.uid() = user_id);
drop policy if exists "own notif prefs update" on notification_preferences;
create policy "own notif prefs update" on notification_preferences for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- STUDY SESSIONS — ties the Study Room timer to real Course Planner
-- work instead of it running as a standalone stopwatch. topic_id /
-- checklist_item_id are nullable: a session can still run untethered
-- (e.g. a break, or a student who skips picking a topic), but when set
-- they're what let a session end by writing a confidence rating back
-- onto the checklist item it was actually about.
-- ============================================================

create table if not exists study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid references course_topics(id) on delete set null,
  checklist_item_id uuid references course_checklist_items(id) on delete set null,
  mode text not null default 'pomodoro',
  planned_minutes int not null,
  actual_seconds int not null default 0,
  completed boolean not null default false,
  finished_task boolean,
  confidence_after int,
  distraction_count int not null default 0,
  distraction_seconds int not null default 0,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists study_sessions_user_created_idx on study_sessions (user_id, created_at desc);

alter table study_sessions enable row level security;

drop policy if exists "own sessions select" on study_sessions;
create policy "own sessions select" on study_sessions for select using (auth.uid() = user_id);
drop policy if exists "own sessions insert" on study_sessions;
create policy "own sessions insert" on study_sessions for insert with check (auth.uid() = user_id);
drop policy if exists "own sessions update" on study_sessions;
create policy "own sessions update" on study_sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- VERIFY: after running, this should return 4 rows per table
-- for notes, reminders, grades and club_memberships; 3 rows for
-- profiles; 1 row each for announcements and clubs
-- ============================================================
-- select tablename, policyname from pg_policies
-- where tablename in ('notes','reminders','profiles','grades','announcements','clubs','club_memberships') order by tablename;
