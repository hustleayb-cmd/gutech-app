// Outlook Calendar sync via Microsoft Graph, using MSAL's browser PKCE flow —
// no client secret ships to the browser, no backend hop required. The app is
// registered once in Azure AD (see README-outlook-setup.md); everything here
// just talks to that app registration.
import { PublicClientApplication } from '@azure/msal-browser';

const CLIENT_ID = import.meta.env.VITE_MS_CLIENT_ID;
// 'common' accepts both personal Microsoft accounts (outlook.com, live.com)
// and work/school accounts — the broadest option, and what most student
// setups need since GUtech email may or may not be on Azure AD.
const TENANT = import.meta.env.VITE_MS_TENANT_ID || 'common';
// ReadWrite (not just Read) — the app pushes locally-created events into
// Outlook too, not just pulling them, and the "join club" flow drafts (not
// sends) an email in the student's own Drafts folder for them to review.
// Requires the matching delegated permissions on the Azure app
// registration (see README-outlook-setup.md).
const SCOPES = ['User.Read', 'Calendars.ReadWrite', 'Mail.ReadWrite'];

// Sign-in uses a full-page redirect, not a popup. Popups are blocked
// outright by some browsers/extensions regardless of timing tricks — a
// redirect can't be blocked the same way, at the cost of a full page
// reload. `RETURN_TAB_KEY` is how the Calendar tab survives that reload.
export const RETURN_TAB_KEY = 'gutech-post-msal-tab';

let msalInstance = null;
let initPromise = null;
let initialized = false;

export function outlookConfigured() {
  return Boolean(CLIENT_ID);
}

function getMsal() {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication({
      auth: {
        clientId: CLIENT_ID,
        authority: `https://login.microsoftonline.com/${TENANT}`,
        redirectUri: window.location.origin,
      },
      cache: {
        // localStorage so the session survives a refresh, not just the tab.
        cacheLocation: 'localStorage',
      },
    });
  }
  return msalInstance;
}

// Runs once at module load (see bottom of file): initializes MSAL, then
// processes a redirect response if we've just been bounced back from
// Microsoft's login page. Everything else awaits this instead of redoing it.
async function ready() {
  const msal = getMsal();
  if (!initPromise) {
    initPromise = msal.initialize()
      .then(() => msal.handleRedirectPromise())
      .then(result => {
        if (result?.account) msal.setActiveAccount(result.account);
        initialized = true;
        return msal;
      });
  }
  return initPromise;
}

if (CLIENT_ID) { ready().catch(() => {}); }

// Resolves once init + any pending redirect response has been processed —
// callers that need to know the *final* signed-in state (not just "MSAL
// object exists") should await this rather than read getOutlookAccount()
// synchronously right after mount.
export async function whenOutlookReady() {
  if (!CLIENT_ID) return null;
  await ready();
  return getOutlookAccount();
}

export function getOutlookAccount() {
  if (!CLIENT_ID) return null;
  const msal = getMsal();
  const accounts = msal.getAllAccounts();
  return accounts[0] || null;
}

// Interactive sign-in. Navigates the whole page away to Microsoft's login,
// then back to redirectUri — the app remounts and whenOutlookReady() above
// picks up the result. Not awaited for a return value on purpose: by the
// time this promise would resolve, the page is already navigating away.
export async function connectOutlook(returnTab = 'calendar') {
  if (!CLIENT_ID) throw new Error('Outlook sync is not configured (missing VITE_MS_CLIENT_ID).');
  const msal = await ready();
  sessionStorage.setItem(RETURN_TAB_KEY, returnTab);
  await msal.loginRedirect({ scopes: SCOPES, prompt: 'select_account' });
}

export async function disconnectOutlook() {
  const msal = await ready();
  const account = getOutlookAccount();
  if (account) await msal.clearCache({ account });
}

// Silent-first token fetch. Falls back to a redirect (not a popup, for the
// same blocking reason as connectOutlook) only when the cached session has
// actually expired or been revoked — rare within a single sitting.
async function getAccessToken() {
  const msal = await ready();
  const account = getOutlookAccount();
  if (!account) throw new Error('Not connected to Outlook.');
  try {
    const res = await msal.acquireTokenSilent({ scopes: SCOPES, account });
    return res.accessToken;
  } catch {
    sessionStorage.setItem(RETURN_TAB_KEY, 'calendar');
    await msal.acquireTokenRedirect({ scopes: SCOPES, account });
    return null; // unreachable — acquireTokenRedirect navigates away
  }
}

// Pushes a locally-created note/event into the signed-in user's default
// Outlook calendar — the other direction of sync, so an event added in this
// app shows up in Outlook too, not just the reverse. Same 1-hour block the
// in-app "quick add" uses. Returns the Graph event id, or throws.
export async function createOutlookEvent({ title, date, time, durationMinutes = 60, description = '' }) {
  const token = await getAccessToken();
  if (!token) throw new Error('Not connected to Outlook.');
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const start = `${date}T${time}:00`;
  const [h, m] = time.split(':').map(Number);
  const endTotalMin = h * 60 + m + durationMinutes;
  const end = `${date}T${String(Math.floor(endTotalMin / 60) % 24).padStart(2, '0')}:${String(endTotalMin % 60).padStart(2, '0')}:00`;

  const resp = await fetch('https://graph.microsoft.com/v1.0/me/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subject: title,
      body: { contentType: 'text', content: description },
      start: { dateTime: start, timeZone: tz },
      end: { dateTime: end, timeZone: tz },
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Microsoft Graph error ${resp.status}: ${body.slice(0, 200)}`);
  }

  const created = await resp.json();
  return created.id;
}

// Creates a draft (does NOT send) in the signed-in student's own Outlook
// Drafts folder — backs the "join club" automation. The student reviews
// and sends it themselves; the app never sends mail on its own. Returns
// the created message's webLink so the caller can open it directly in
// Outlook Web for them.
export async function createOutlookDraft({ to, subject, body }) {
  const token = await getAccessToken();
  if (!token) throw new Error('Not connected to Outlook.');

  const resp = await fetch('https://graph.microsoft.com/v1.0/me/messages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subject,
      body: { contentType: 'text', content: body },
      toRecipients: [{ emailAddress: { address: to } }],
    }),
  });

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    throw new Error(`Microsoft Graph error ${resp.status}: ${errBody.slice(0, 200)}`);
  }

  const created = await resp.json();
  return created.webLink;
}

// Pulls events in [startDate, endDate) (ISO yyyy-mm-dd) from the signed-in
// user's default calendar and normalizes them into the same shape the app's
// own notes/events use, so the Calendar view can render both side by side.
export async function fetchOutlookEvents(startDate, endDate) {
  const token = await getAccessToken();
  if (!token) return [];
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const url = new URL('https://graph.microsoft.com/v1.0/me/calendarview');
  url.searchParams.set('startDateTime', `${startDate}T00:00:00`);
  url.searchParams.set('endDateTime', `${endDate}T00:00:00`);
  url.searchParams.set('$orderby', 'start/dateTime');
  url.searchParams.set('$top', '100');
  url.searchParams.set('$select', 'id,subject,bodyPreview,start,end,isAllDay,webLink,location');

  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Prefer: `outlook.timezone="${tz}"`,
    },
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Microsoft Graph error ${resp.status}: ${body.slice(0, 200)}`);
  }

  const { value } = await resp.json();
  return (value || []).map(ev => {
    return {
      id: `outlook-${ev.id}`,
      source: 'outlook',
      title: ev.subject || 'Untitled event',
      location: ev.location?.displayName || '',
      body: ev.bodyPreview || '',
      webLink: ev.webLink,
      scheduled_date: ev.start.dateTime.slice(0, 10),
      scheduled_time: ev.isAllDay ? '' : ev.start.dateTime.slice(11, 16),
      // End time (same-day only — good enough for sizing a grid block; a
      // multi-day event just clips at the visible window's last hour).
      scheduled_end_time: ev.isAllDay ? '' : ev.end.dateTime.slice(0, 10) === ev.start.dateTime.slice(0, 10)
        ? ev.end.dateTime.slice(11, 16)
        : '',
      isAllDay: ev.isAllDay,
    };
  });
}
