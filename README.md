# GUtech Student Companion

A demo app with real authentication, branded for GUtech (German University of
Technology in Oman). Nine sections: **Home** (dashboard), **Ask** (your n8n
bot), **Calendar**, **Notes**, **Due** (reminders), **Grades** (GPA tracker),
**Announcements**, **Campus** (map & services directory), and **Profile**
(student ID card).

Each student sees only their own notes, reminders, grades and profile,
enforced at the database level. Announcements are read-only and shared by
everyone signed in.

---

## Setup — about 15 minutes

### 1. Create the database tables

Supabase → **SQL Editor** → **New query** → paste the contents of `schema.sql` → **Run**.

This creates the `notes`, `reminders`, `profiles`, `grades` and
`announcements` tables and — importantly — the Row Level Security policies
that keep each student's data private. It also seeds three sample
announcements so the Announcements tab and Home dashboard aren't empty on
first run.

Verify it worked:

```sql
select tablename, policyname from pg_policies
where tablename in ('notes','reminders','profiles','grades','announcements') order by tablename;
```

You should see **19 rows** (4 policies each for notes, reminders, grades; 3 for profiles; 1 for announcements). If you see fewer, RLS isn't fully on and some data could leak between users. Don't skip this check.

> **Already running the app from before this update?** Your existing
> Supabase project only has `notes` and `reminders`. Re-run `schema.sql` —
> it's safe to run again, existing tables and data are left alone and only
> the new tables get created.

### Posting announcements

There's no admin UI yet — insert new rows straight from the SQL editor:

```sql
insert into announcements (title, body, category, pinned)
values ('Title here', 'Body text here', 'deadline', false);
-- category is one of: general, academic, event, deadline
```

### 2. Turn on email sign-ups

Supabase → **Authentication** → **Providers** → make sure **Email** is enabled.

For a demo, also go to **Authentication → Sign In / Providers** and switch **Confirm email** OFF. Otherwise every test account needs an email click-through.

> Checked during this update: this project currently has **Confirm email
> ON** — a fresh sign-up gets "Email not confirmed" on the next sign-in
> until you either flip the toggle off or confirm the account's email.
> Flip it off before demoing, or manually confirm test accounts from
> **Authentication → Users**.

### 3. Configure the app

```bash
cp .env.example .env
```

Open `.env` and fill in:

- `VITE_SUPABASE_URL` — Supabase → Project Settings → API → Project URL
- `VITE_SUPABASE_ANON_KEY` — the **anon / public** key, *not* service_role
- `VITE_N8N_CHAT_WEBHOOK` — your n8n Chat Trigger webhook URL (optional)

> **Why the anon key is safe here:** it's designed to be public. Row Level Security is what actually protects the data. The service_role key bypasses RLS entirely and must never go in a browser app.

### 4. Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173

---

## Connecting the Ask tab to n8n

1. Open your **GUtech - Student Bot** workflow
2. Click the **Chat Trigger** node
3. Turn **Make Chat Publicly Available** ON
4. Copy the webhook URL — it looks like
   `https://yourname.app.n8n.cloud/webhook/abc-123/chat`
5. Paste it into `VITE_N8N_CHAT_WEBHOOK` in `.env`
6. **Activate the workflow** (toggle, top right) — an inactive workflow won't respond
7. Restart `npm run dev` after changing `.env`

**If you get a CORS error in the browser console**, add your dev origin to the Chat Trigger's allowed origins, or set it to `*` for the demo.

The app sends the signed-in user's ID as `sessionId`, so each student gets their own conversation memory in the bot.

---

## Testing the privacy boundary

Worth doing before you demo, because it's the thing people ask about:

1. Create account A, write a note
2. Sign out, create account B
3. Account B's Notes tab should be **empty**

If B can see A's note, RLS didn't apply — re-run `schema.sql` and check the policy query above.

---

## Before demoing

- Use fake accounts and fake content. `test@example.com`, not real student emails.
- Don't enter real student IDs or phone numbers anywhere, including the club request flow in the bot.
- Have an answer ready for "where is this data stored?" — it's a Supabase project on a personal account, which is fine for a demo and would need to move to university-controlled infrastructure for production.

---

## What this is and isn't

**Is:** real authentication, real per-user data, real database-level isolation, working reminders with browser notifications.

**Isn't:** production-ready. Missing password reset, email verification flow, offline support, mobile push notifications (browser notifications only fire while a tab is open), and any integration with GUtech's actual student systems.

For production the auth would ideally be single sign-on against GUtech's Microsoft accounts rather than separate passwords — that's an IT conversation, not a code change.

---

## Structure

```
schema.sql               database tables + RLS policies
src/
  supabase.js             client setup, reads .env
  App.jsx                 session handling, tab navigation
  styles.css              GUtech design tokens and all styling
  lib/
    gpa.js                shared GPA calculation used by Grades and Home
  components/
    Logo.jsx               GUtech wordmark
    Icons.jsx               shared line-icon set
    Auth.jsx                 sign in / sign up
    Home.jsx                 dashboard: due-soon, GPA snapshot, quick links, latest announcement
    Chat.jsx                  talks to the n8n webhook (Ask tab)
    Calendar.jsx               weekly timetable, built from Notes' scheduled fields
    Notes.jsx                   notes CRUD + daily timetable view
    Reminders.jsx                reminders CRUD + browser notifications (Due tab)
    Grades.jsx                    course/grade CRUD + GPA ring
    Announcements.jsx              read-only campus news feed
    Campus.jsx                      map embed + services directory
    Profile.jsx                     editable student ID card
    More.jsx                         bottom sheet for the tabs that don't fit the main nav bar
```

Navigation is split in two: **Home / Ask / Calendar / Notes** sit in the
bottom bar (capped at four plus More — more than five items in a bottom bar
hurts usability); **Due / Grades / Announcements / Campus / Profile** live
one tap away behind **More**.

The GUtech wordmark (`Logo.jsx`) is reproduced in markup/CSS rather than a
raster image, so it stays crisp at any size. Drop the official logo file
into `src/assets` and swap it in there if a pixel-exact version is needed.
