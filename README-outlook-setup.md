# Outlook Calendar sync — Azure AD setup

The Calendar tab has a **Sync Outlook** button that signs a student into
their Microsoft account (personal or work/school) and two-way syncs their
Outlook calendar: existing Outlook events show up read-only alongside notes
and reminders, and events created in this app are pushed into Outlook too.
It talks to [Microsoft Graph](https://learn.microsoft.com/en-us/graph/)
directly from the browser using
[MSAL.js](https://github.com/AzureAD/microsoft-authentication-library-for-js)
— no backend, no client secret. To turn it on you need one thing: an Azure
AD **App Registration**, which only you (the app owner) can create.

This takes about 5 minutes and is free (no Azure subscription cost for an
app registration).

## 1. Create the app registration

1. Go to the [Azure Portal → App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) and sign in with any Microsoft account.
   - **Personal Microsoft accounts** (outlook.com, live.com, or a plain
     Gmail-based Microsoft account) need an Azure AD directory attached
     before "New registration" works at all. If you see *"These
     applications are associated with your account but are not contained
     within any directory"*, sign up for the free [Azure trial](https://azure.microsoft.com/en-us/free/)
     first — it provisions a directory in a couple of minutes. (The
     Microsoft 365 Developer Program is *not* a reliable substitute here —
     sandbox eligibility is inconsistent.)
2. Click **New registration**.
3. Fill in:
   - **Name**: `GUtech Student Companion` (or anything recognizable)
   - **Supported account types**: choose **"Accounts in any organizational directory and personal Microsoft accounts"** — this matches the app's `common` authority and lets both personal (outlook.com) and work/school accounts sign in.
   - **Redirect URI**: platform **Single-page application (SPA)**, URI:
     - `http://localhost:5173` for local dev
     - plus your production URL once you deploy (e.g. `https://your-app.vercel.app`) — you can add multiple redirect URIs later under **Authentication**.
4. Click **Register**.

## 2. Grant the Calendar permission

1. In your new app, go to **API permissions → Add a permission → Microsoft Graph → Delegated permissions**.
2. Add:
   - `Calendars.ReadWrite` — read **and create** events on the signed-in
     user's calendar (needed for the two-way sync; `Calendars.Read` alone
     only covers the read direction)
   - `Mail.ReadWrite` — lets the app create a **draft** email in the
     student's own Drafts folder for the "join club" flow (see below). It
     never reads existing mail or sends anything — Mail.ReadWrite is
     required because drafting is a mailbox write, unlike `Mail.Send`
     which only covers the send action itself.
   - `User.Read` — basic profile (added by default)
3. Personal Microsoft accounts don't need admin consent for these; if you
   restricted sign-in to your own organization's tenant, click
   **Grant admin consent** if prompted. Note some organizations (e.g. a
   university's Microsoft 365 tenant) block unverified third-party apps
   entirely for their accounts — in that case, syncing an org-managed
   student account isn't possible without that org's IT approving the app.

## 3. Copy the IDs into `.env`

On the app's **Overview** page, copy:

- **Application (client) ID** → `VITE_MS_CLIENT_ID`
- **Directory (tenant) ID** → only needed if you want to restrict sign-in to
  your own organization; otherwise leave `VITE_MS_TENANT_ID=common`

```env
VITE_MS_CLIENT_ID=00000000-0000-0000-0000-000000000000
VITE_MS_TENANT_ID=common
```

Restart the dev server after editing `.env` (Vite only reads it at startup).

## How it works

- `src/lib/outlook.js` wraps `@azure/msal-browser` (PKCE, no secret needed
  for a public/SPA client) and Graph's `calendarView` (read) and `events`
  (create) endpoints.
- Sign-in is a **full-page redirect** (`loginRedirect`), not a popup —
  popups get silently blocked by some browsers/extensions regardless of
  how carefully the click-to-popup timing is handled, and a redirect can't
  be blocked the same way. `RETURN_TAB_KEY` in sessionStorage is how the
  Calendar tab gets restored after the round trip.
- The token is cached in `localStorage` by MSAL, so a student stays signed
  in across reloads until they hit **Disconnect** or the token expires.
- Once connected, the Calendar tab fetches events for whatever range is on
  screen and re-syncs automatically when you page forward/back, or on
  demand via the **Outlook synced** chip.
- **Pulling from Outlook**: existing Outlook events render read-only — a
  distinct blue block in the time grid, a blue chip in the month grid, and
  a detail card with an "Open in Outlook" link. They're never written back
  to Supabase or editable from this app.
- **Pushing to Outlook**: creating an event in this app (via the quick-add
  sheet or the **+** button) also creates it on the connected account's
  default Outlook calendar, best-effort — if the local save succeeds but
  the Outlook push fails (expired session, no write consent yet, offline),
  the event still saves locally and a soft warning explains the Outlook
  side didn't go through. Editing or deleting a note locally does **not**
  currently propagate to Outlook — only creation is two-way.
- **Join club automation**: joining a club (More → Clubs) requires Outlook
  to be connected. On join, the app calls Graph to create a **draft**
  email in the student's own Drafts folder — same template every time
  (name, student ID, club), addressed to that club's `contact_email`,
  ending with a short `Ref: XXXXXXXX` line (the first 8 characters of the
  new `club_memberships` row's id) — then opens it in a new Outlook Web
  tab (or the native Outlook app on mobile) via the draft's `webLink`. The
  app never sends anything itself; the student reviews the draft and hits
  **Send** themselves.
- **Waiting-for-response status**: every new membership row starts with
  `club_memberships.status = 'pending'`, shown in the UI as an amber
  "Waiting for response" button. The app never advances this itself — it's
  meant to be flipped by an **n8n** workflow (built and owned separately)
  that watches the student's inbox for the club's reply and matches it
  back to the right row using that `Ref:` code. To flip a row, n8n should
  call the Supabase REST API directly, using its own `service_role` key
  (kept only in n8n's credential store — never in this app's frontend):

  ```
  PATCH https://<project-ref>.supabase.co/rest/v1/club_memberships?id=eq.<membership-id>
  Headers:
    apikey: <service_role key>
    Authorization: Bearer <service_role key>
    Content-Type: application/json
    Prefer: return=minimal
  Body:
    { "status": "accepted" }
  ```

  (`<membership-id>` is the full UUID — n8n can find it by first
  `GET`-ing `.../club_memberships?select=id&id.ilike=<ref-code>*` if only
  the short `Ref:` code was recovered from the reply, or by matching on
  `student_id`/`club_id` if that's easier from the email content.) Once
  patched, Supabase Realtime pushes the change straight to the student's
  open Clubs tab — the button relabels to "Accepted" with no refresh
  needed. `status` can also be set to `'declined'`, which the UI shows as
  "Not accepted" and lets the student remove and try again.

## Troubleshooting

- **"AADSTS50011: redirect URI mismatch"** — the URL the app is running on
  isn't listed as a Redirect URI on the app registration. Add it under
  **Authentication → Single-page application**.
- **"popup_window_error" / sign-in does nothing** — this app uses a
  redirect, not a popup, so this shouldn't come up; if you see it, check
  you're on the latest code (`connectOutlook()` should call
  `loginRedirect`, not `loginPopup`).
- **"Need admin approval" screen** — the signed-in account's organization
  (e.g. a university tenant) requires an admin to approve unverified
  third-party apps. Not fixable from the student side; use a personal
  Microsoft account instead, or get the org's IT to grant tenant-wide
  consent for this app's Client ID.
- **Nothing happens when clicking "Sync Outlook"** — check
  `VITE_MS_CLIENT_ID` is actually set and the dev server was restarted.
- **Event saves locally but not in Outlook** — check the API permissions
  include `Calendars.ReadWrite` (not just `Calendars.Read`); if you added
  it after already signing in once, disconnect and reconnect so the new
  scope gets consented to.
