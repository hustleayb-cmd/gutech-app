import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import {
  ChevronLeft, ChevronRight, PlusIcon, CloseIcon, TrashIcon, BellIcon, CheckIcon, SyncIcon,
  TimerIcon, BookIcon, MapPinIcon, SearchIcon,
} from './Icons';
import { outlookConfigured, getOutlookAccount, whenOutlookReady, connectOutlook, disconnectOutlook, fetchOutlookEvents, createOutlookEvent } from '../lib/outlook';

const PRIORITY_WEIGHTS = { high: 1, medium: 2, low: 3 };
const PRIORITY_LABELS = { high: '🔥 High', medium: '⚡ Medium', low: '🌱 Low' };
const PRIORITY_ORDER = ['high', 'medium', 'low'];

// Visible hour range for the time grid — trimmed to a normal school day,
// same as Outlook's own default scroll window.
const START_HOUR = 7;   // 7 AM
const END_HOUR = 22;    // 10 PM
const HOUR_PX = 56;     // pixel height of one hour row in the grid
const GRID_START_MIN = START_HOUR * 60;
const GRID_END_MIN = (END_HOUR + 1) * 60;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DOW_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay(); // 0 = Sun ... 6 = Sat
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }

function formatHour(h) {
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${period}`;
}

function formatClock(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatLong(d) {
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function minutesOf(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// A reminder has no priority field of its own, so we translate urgency into
// the same high/medium/low language notes already use — overdue reads as
// high, due within two days as medium, everything else as low. Keeps one
// visual vocabulary across both data types, which is the whole point.
function reminderUrgency(r) {
  if (r.done) return null;
  const ms = new Date(r.due_at) - Date.now();
  if (ms < 0) return 'high';
  if (ms < 48 * 3600 * 1000) return 'medium';
  return 'low';
}

export default function Calendar({ userId }) {
  const [notes, setNotes] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [view, setView] = useState('week'); // 'day' | 'week' | 'month'
  // The single source of truth for "where you are" — every view derives
  // its visible range from this one selected date.
  const [selectedDate, setSelectedDate] = useState(() => toISODate(new Date()));
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  // Quick-add sheet (Outlook-style: tap a time slot, name it, save — with a
  // "More options" toggle for course/priority/description when needed).
  const [isAdding, setIsAdding] = useState(false);
  const [addExpanded, setAddExpanded] = useState(false);
  const [activeDate, setActiveDate] = useState(null);
  const [title, setTitle] = useState('');
  const [course, setCourse] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState('low');
  const [scheduledTime, setScheduledTime] = useState('');
  const [err, setErr] = useState('');

  // Detail card state (opened by tapping an event block)
  const [selectedNote, setSelectedNote] = useState(null);
  const [selectedOutlookEvent, setSelectedOutlookEvent] = useState(null);

  // Outlook sync — account is null until the student connects; events are
  // fetched read-only for whatever range is currently on screen.
  const [outlookAccount, setOutlookAccount] = useState(() => getOutlookAccount());
  const [outlookEvents, setOutlookEvents] = useState([]);
  const [outlookSyncing, setOutlookSyncing] = useState(false);
  const [outlookErr, setOutlookErr] = useState('');

  useEffect(() => { loadNotes(); loadReminders(); }, []);

  // Sign-in is a full-page redirect (see src/lib/outlook.js for why), so the
  // "am I connected" answer isn't final until MSAL has processed a possible
  // redirect response after this remount — re-check once that settles.
  useEffect(() => { whenOutlookReady().then(setOutlookAccount); }, []);

  // Live sync — a note/reminder added, edited or deleted from anywhere
  // (another tab, another device) shows up here immediately.
  useEffect(() => {
    const notesChannel = supabase
      .channel('calendar-notes-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${userId}` },
        () => loadNotes())
      .subscribe();
    const remindersChannel = supabase
      .channel('calendar-reminders-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reminders', filter: `user_id=eq.${userId}` },
        () => loadReminders())
      .subscribe();
    return () => { supabase.removeChannel(notesChannel); supabase.removeChannel(remindersChannel); };
  }, [userId]);

  async function loadNotes() {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) { setErr(error.message); return; }

    const cleanedData = (data ?? []).map(note => ({
      ...note,
      priority: (note.priority || 'low').replace(/['"]/g, '').toLowerCase(),
      scheduled_date: note.scheduled_date || '',
      scheduled_time: note.scheduled_time || ''
    }));

    const sorted = cleanedData.sort((a, b) => {
      const pA = PRIORITY_WEIGHTS[a.priority] || 3;
      const pB = PRIORITY_WEIGHTS[b.priority] || 3;
      return pA - pB;
    });

    setNotes(sorted);
  }

  async function loadReminders() {
    const { data, error } = await supabase.from('reminders').select('*').order('due_at', { ascending: true });
    if (error) { setErr(error.message); return; }
    setReminders(data ?? []);
  }

  async function toggleReminder(r) {
    const { error } = await supabase.from('reminders').update({ done: !r.done }).eq('id', r.id);
    if (error) { setErr(error.message); return; }
    loadReminders();
  }

  function openAddForm(dateStr, hourPrefix) {
    setErr('');
    setActiveDate(dateStr);
    setScheduledTime(hourPrefix ? `${hourPrefix}:00` : '');
    setTitle(''); setCourse(''); setBody(''); setPriority('low');
    setAddExpanded(false);
    setIsAdding(true);
  }

  function closeAddForm() {
    setIsAdding(false);
    setAddExpanded(false);
    setActiveDate(null);
    setErr('');
  }

  // Same 1-hour double-booking check as before
  async function handleAddEvent() {
    if (!title.trim() && !body.trim()) {
      setErr('Give the event a title or some text.');
      return;
    }
    if (!activeDate || !scheduledTime) {
      setErr('Please provide a scheduled time.');
      return;
    }

    const targetHour = scheduledTime.split(':')[0];
    const isBusy = notes.some(n => {
      if (n.scheduled_date !== activeDate || !n.scheduled_time) return false;
      const noteHour = n.scheduled_time.split(':')[0];
      return noteHour === targetHour;
    });

    if (isBusy) {
      setErr('YOU ARE ALREADY BUSY AT THAT TIME');
      return;
    }

    setErr('');
    const finalTitle = title.trim() || 'Untitled Event';
    const { error } = await supabase.from('notes').insert({
      user_id: userId,
      title: finalTitle,
      course: course.trim(),
      body: body.trim(),
      priority: priority,
      scheduled_date: activeDate,
      scheduled_time: scheduledTime
    });

    if (error) { setErr(error.message); return; }

    // Two-way sync: push this new event into Outlook too, when connected.
    // Best-effort — the local save already succeeded, so a push failure
    // (expired session, missing consent for the write scope, offline)
    // surfaces as a soft warning instead of losing the event the student
    // just created.
    if (outlookAccount) {
      try {
        await createOutlookEvent({
          title: finalTitle,
          date: activeDate,
          time: scheduledTime,
          description: body.trim(),
        });
        syncOutlookRange(outlookRangeStart, (() => { const e = new Date(outlookRangeEnd + 'T00:00:00'); e.setDate(e.getDate() + 1); return toISODate(e); })());
      } catch (e) {
        setOutlookErr(`Saved locally, but couldn't push to Outlook: ${e.message}`);
      }
    }

    setTitle(''); setCourse(''); setBody(''); setPriority('low'); setScheduledTime('');
    closeAddForm();
    loadNotes();
  }

  async function removeNote(id) {
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) { setErr(error.message); return; }
    setSelectedNote(null);
    loadNotes();
  }

  function matchesSearch(titleStr, courseStr) {
    if (!search.trim()) return true;
    const s = search.trim().toLowerCase();
    return (titleStr || '').toLowerCase().includes(s) || (courseStr || '').toLowerCase().includes(s);
  }

  function notesFor(dateStr) {
    return notes.filter(n => n.scheduled_date === dateStr && n.scheduled_time);
  }

  function remindersFor(dateStr) {
    return reminders.filter(r => toISODate(new Date(r.due_at)) === dateStr);
  }

  function outlookEventsFor(dateStr) {
    return outlookEvents.filter(e => e.scheduled_date === dateStr);
  }

  async function handleConnectOutlook() {
    setOutlookErr('');
    try {
      // Navigates the page away to Microsoft's login on success — there's
      // nothing to set here; the redirect back re-mounts the app and the
      // whenOutlookReady() effect above picks up the signed-in account.
      await connectOutlook();
    } catch (e) {
      setOutlookErr(e.message || 'Could not sign in to Outlook.');
    }
  }

  async function handleDisconnectOutlook() {
    await disconnectOutlook();
    setOutlookAccount(null);
    setOutlookEvents([]);
    setOutlookErr('');
  }

  async function syncOutlookRange(startDate, endDate) {
    if (!outlookAccount) return;
    setOutlookSyncing(true);
    setOutlookErr('');
    try {
      const events = await fetchOutlookEvents(startDate, endDate);
      setOutlookEvents(events);
    } catch (e) {
      setOutlookErr(e.message || 'Outlook sync failed.');
    } finally {
      setOutlookSyncing(false);
    }
  }

  // Which priority colors show up on a given day — notes AND reminders
  // both feed this, so the dots mean the same thing everywhere they appear.
  function dotsFor(dateStr) {
    const present = new Set(notes.filter(n => n.scheduled_date === dateStr).map(n => n.priority));
    remindersFor(dateStr).forEach(r => { const u = reminderUrgency(r); if (u) present.add(u); });
    return PRIORITY_ORDER.filter(p => present.has(p));
  }

  // Month-cell chips (Outlook-style: a couple of titled pills per day, not
  // just dots) — notes and Outlook events, sorted by time, capped at 2 with
  // a "+N more" overflow label.
  function chipsFor(dateStr) {
    const items = [
      ...notesFor(dateStr).map(n => ({ id: n.id, title: n.title, time: n.scheduled_time, cls: `priority-${n.priority}` })),
      ...outlookEventsFor(dateStr).map(e => ({ id: e.id, title: e.title, time: e.scheduled_time || '', cls: 'source-outlook' })),
    ].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    return { shown: items.slice(0, 2), overflow: Math.max(0, items.length - 2) };
  }

  const weekStart = getMonday(new Date(selectedDate + 'T00:00:00'));
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const todayStr = toISODate(new Date());
  const selectedDateObj = new Date(selectedDate + 'T00:00:00');

  function shiftSelected(days) {
    const nd = new Date(selectedDateObj);
    nd.setDate(nd.getDate() + days);
    setSelectedDate(toISODate(nd));
  }

  function shiftMonth(delta) {
    setMonthCursor(m => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  function selectDayInMonth(d) {
    setSelectedDate(toISODate(d));
    if (d.getMonth() !== monthCursor.getMonth() || d.getFullYear() !== monthCursor.getFullYear()) {
      setMonthCursor(startOfMonth(d));
    }
  }

  function goToday() {
    const today = new Date();
    setSelectedDate(toISODate(today));
    setMonthCursor(startOfMonth(today));
  }

  // Month grid — adaptive row count (5 or 6 weeks), Monday-first.
  const monthCells = [];
  {
    const first = monthCursor;
    const firstWeekday = (first.getDay() + 6) % 7; // Mon=0..Sun=6
    const gridStart = new Date(first);
    gridStart.setDate(gridStart.getDate() - firstWeekday);
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
    for (let i = 0; i < totalCells; i++) {
      const d = new Date(gridStart);
      d.setDate(d.getDate() + i);
      monthCells.push(d);
    }
  }

  // Whatever range is currently visible. Synced automatically whenever the
  // connected account or visible range changes, so paging around keeps
  // Outlook events in step.
  const outlookRangeStart = toISODate(view === 'month' ? monthCells[0] : view === 'week' ? weekDays[0] : selectedDateObj);
  const outlookRangeEnd = toISODate(view === 'month' ? monthCells[monthCells.length - 1] : view === 'week' ? weekDays[6] : selectedDateObj);

  useEffect(() => {
    if (!outlookAccount) return;
    const end = new Date(outlookRangeEnd + 'T00:00:00');
    end.setDate(end.getDate() + 1); // Graph's endDateTime is exclusive
    syncOutlookRange(outlookRangeStart, toISODate(end));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlookAccount, outlookRangeStart, outlookRangeEnd]);

  const dueToday = remindersFor(selectedDate);
  const dayNotes = notesFor(selectedDate);
  const dayOutlookEvents = outlookEventsFor(selectedDate);
  const allDayOutlookEvents = dayOutlookEvents.filter(e => e.isAllDay);
  const timedOutlookEvents = dayOutlookEvents.filter(e => !e.isAllDay);

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showNowLine = selectedDate === todayStr && nowMin >= GRID_START_MIN && nowMin <= GRID_END_MIN;

  // Positions a block inside the hour grid from a start/end time pair,
  // clipped to the visible 7am–10pm window.
  function gridBlockStyle(startHHMM, endHHMM) {
    const startMin = Math.max(minutesOf(startHHMM), GRID_START_MIN);
    const endMin = Math.min(endHHMM ? minutesOf(endHHMM) : startMin + 60, GRID_END_MIN);
    const top = ((startMin - GRID_START_MIN) / 60) * HOUR_PX;
    const height = Math.max(((Math.max(endMin, startMin + 20) - startMin) / 60) * HOUR_PX, 22);
    return { top, height };
  }

  return (
    <>
      {/* ============ HEADER ============ */}
      <div className="cal-header">
        <div className="cal-header-avatar">{(userId || 'S').toString().slice(0, 1).toUpperCase()}</div>
        <div className="cal-header-titles">
          <span className="cal-header-title">
            {view === 'month'
              ? monthCursor.toLocaleDateString(undefined, { month: 'long' })
              : selectedDateObj.toLocaleDateString(undefined, { month: 'long' })}
          </span>
          <span className="cal-header-sub">
            {view === 'month' ? monthCursor.getFullYear() : formatLong(selectedDateObj)}
          </span>
        </div>
        <button type="button" className="ghost icon-btn cal-header-search-btn" onClick={() => setSearchOpen(s => !s)} aria-label="Search events">
          <SearchIcon size={17} />
        </button>
      </div>

      {searchOpen && (
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter by course or title..."
          autoFocus
          style={{ marginBottom: 10 }}
        />
      )}

      <div className="chip-row" style={{ marginBottom: 14 }}>
        <button className={`chip ${view === 'day' ? 'chip-on' : ''}`} onClick={() => setView('day')}>Day</button>
        <button className={`chip ${view === 'week' ? 'chip-on' : ''}`} onClick={() => setView('week')}>Week</button>
        <button className={`chip ${view === 'month' ? 'chip-on' : ''}`} onClick={() => setView('month')}>Month</button>

        {outlookAccount ? (
          <button
            type="button"
            className="chip chip-outlook"
            onClick={() => syncOutlookRange(outlookRangeStart, (() => { const e = new Date(outlookRangeEnd + 'T00:00:00'); e.setDate(e.getDate() + 1); return toISODate(e); })())}
            disabled={outlookSyncing}
            title={outlookAccount.username}
          >
            <SyncIcon size={13} className={outlookSyncing ? 'spin' : ''} />
            {outlookSyncing ? 'Syncing…' : 'Outlook synced'}
          </button>
        ) : (
          <button
            type="button"
            className="chip chip-outlook"
            onClick={handleConnectOutlook}
            disabled={!outlookConfigured()}
            title={outlookConfigured() ? 'Sign in with Microsoft to sync your Outlook calendar' : 'Outlook sync is not configured yet — see README-outlook-setup.md'}
          >
            <SyncIcon size={13} />
            Sync Outlook
          </button>
        )}
        {outlookAccount && (
          <button type="button" className="ghost icon-btn" onClick={handleDisconnectOutlook} aria-label="Disconnect Outlook" title="Disconnect Outlook">
            <CloseIcon size={12} />
          </button>
        )}
      </div>

      {!outlookConfigured() && (
        <div className="notice" style={{ marginBottom: 14 }}>
          Outlook sync isn't configured yet — add <code>VITE_MS_CLIENT_ID</code> to your <code>.env</code> (see{' '}
          <code>README-outlook-setup.md</code>) to turn this on.
        </div>
      )}
      {outlookErr && <div className="notice err">{outlookErr}</div>}
      {err && <div className="notice err">{err}</div>}

      {/* ============ DAY NAV (Day view only) ============ */}
      {view === 'day' && (
        <div className="day-nav">
          <button type="button" className="ghost icon-btn" onClick={() => shiftSelected(-1)} aria-label="Previous day">
            <ChevronLeft size={16} />
          </button>
          <span className={`day-nav-label ${selectedDate === todayStr ? 'is-today' : ''}`}>{formatLong(selectedDateObj)}</span>
          <button type="button" className="ghost icon-btn" onClick={() => shiftSelected(1)} aria-label="Next day">
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* ============ WEEK STRIP ============ */}
      {view === 'week' && (
        <div className="card week-strip-card">
          <div className="row" style={{ marginBottom: 10 }}>
            <button type="button" className="ghost icon-btn" onClick={() => shiftSelected(-7)} aria-label="Previous week">
              <ChevronLeft size={15} />
            </button>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)' }}>
              {weekStart.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
            </span>
            <button type="button" className="ghost icon-btn" onClick={() => shiftSelected(7)} aria-label="Next week">
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="week-strip">
            {weekDays.map((d, i) => {
              const dateStr = toISODate(d);
              const isSelected = dateStr === selectedDate;
              const isToday = dateStr === todayStr;
              const dots = dotsFor(dateStr);
              return (
                <button
                  key={i}
                  type="button"
                  className={`strip-day ${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}`}
                  onClick={() => setSelectedDate(dateStr)}
                >
                  <span className="strip-day-name">{DAY_LABELS[i]}</span>
                  <span className="strip-day-num">{d.getDate()}</span>
                  <span className="strip-day-dots">
                    {dots.map(p => <span key={p} className={`strip-dot priority-${p}`} />)}
                    {outlookEventsFor(dateStr).length > 0 && <span className="strip-dot strip-dot-outlook" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ============ MONTH GRID ============ */}
      {view === 'month' && (
        <div className="card month-grid-card">
          <div className="row" style={{ marginBottom: 12 }}>
            <button type="button" className="ghost icon-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
              <ChevronLeft size={15} />
            </button>
            <span style={{ fontSize: 14, fontWeight: 800 }}>
              {monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </span>
            <button type="button" className="ghost icon-btn" onClick={() => shiftMonth(1)} aria-label="Next month">
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="month-dow-row">
            {DOW_LETTERS.map((d, i) => <span key={i}>{d}</span>)}
          </div>

          <div className="month-cells">
            {monthCells.map((d, i) => {
              const dateStr = toISODate(d);
              const inMonth = d.getMonth() === monthCursor.getMonth();
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              const { shown, overflow } = chipsFor(dateStr);
              const remCount = remindersFor(dateStr).length;
              return (
                <button
                  key={i}
                  type="button"
                  className={`month-cell ${!inMonth ? 'is-outside' : ''} ${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}`}
                  onClick={() => selectDayInMonth(d)}
                  aria-label={d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                >
                  <span className="month-cell-top">
                    <span className="month-cell-num">{d.getDate()}</span>
                    {remCount > 0 && <span className="month-cell-badge">{remCount}</span>}
                  </span>
                  <span className="month-cell-chips">
                    {shown.map(item => (
                      <span key={item.id} className={`month-cell-chip ${item.cls}`}>{item.title}</span>
                    ))}
                    {overflow > 0 && <span className="month-cell-more">+{overflow} more</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!isAdding && (
        <button type="button" className="ghost" onClick={goToday} style={{ margin: '12px 0' }}>
          Jump to today
        </button>
      )}

      {/* ============ QUICK-ADD SHEET ============ */}
      {isAdding && (
        <div className="quick-add-overlay" onClick={closeAddForm}>
          <div className="quick-add-sheet" onClick={e => e.stopPropagation()}>
            <div className="quick-add-handle" />
            <div className="row" style={{ marginBottom: 4 }}>
              <input
                className="quick-add-title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Add title"
                autoFocus
              />
              <button type="button" className="ghost icon-btn" onClick={closeAddForm} aria-label="Cancel">
                <CloseIcon size={16} />
              </button>
            </div>

            <div className="quick-add-row">
              <TimerIcon size={15} />
              <span>{activeDate}</span>
              <input
                type="time"
                value={scheduledTime}
                onChange={e => setScheduledTime(e.target.value)}
                style={{ margin: 0, padding: '6px 10px', width: 'auto' }}
              />
            </div>

            {!addExpanded ? (
              <button type="button" className="ghost quick-add-more" onClick={() => setAddExpanded(true)}>
                More options
              </button>
            ) : (
              <>
                <label htmlFor="ec">Course (optional)</label>
                <input id="ec" value={course} onChange={e => setCourse(e.target.value)} placeholder="CS 2210" />

                <label htmlFor="ep">Priority</label>
                <select id="ep" value={priority} onChange={e => setPriority(e.target.value)}>
                  <option value="high">🔥 High Priority</option>
                  <option value="medium">⚡ Medium Priority</option>
                  <option value="low">🌱 Low Priority</option>
                </select>

                <label htmlFor="eb">Description</label>
                <textarea id="eb" value={body} onChange={e => setBody(e.target.value)} placeholder="Additional notes..." />
              </>
            )}

            {err && <div className="notice err" style={{ marginTop: 8 }}>{err}</div>}

            <button type="button" className="primary" onClick={handleAddEvent} style={{ marginTop: 12 }}>Save event</button>
          </div>
        </div>
      )}

      {/* ============ SELECTED DAY DETAIL ============ */}
      {view !== 'day' && <div className="annot">{formatLong(selectedDateObj)}</div>}

      {dueToday.length > 0 && (
        <div className="agenda-reminders">
          {dueToday.map(r => {
            const urgency = reminderUrgency(r) || 'done';
            return (
              <div key={r.id} className={`agenda-reminder urgency-${urgency} ${r.done ? 'is-done' : ''}`}>
                <BellIcon size={15} />
                <span className="agenda-reminder-title">{r.title}</span>
                <span className="agenda-reminder-kind">{r.kind}</span>
                <button
                  type="button"
                  className="ghost icon-btn"
                  onClick={() => toggleReminder(r)}
                  aria-label={r.done ? `Mark ${r.title} not done` : `Mark ${r.title} done`}
                >
                  <CheckIcon size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {allDayOutlookEvents.length > 0 && (
        <div className="allday-row">
          {allDayOutlookEvents.map(e => (
            <button key={e.id} type="button" className="allday-chip" onClick={() => setSelectedOutlookEvent(e)}>
              <SyncIcon size={12} /> {e.title}
            </button>
          ))}
        </div>
      )}

      {/* ============ TIME GRID ============ */}
      <div className="time-grid-wrap">
        <div className="time-grid" style={{ height: HOURS.length * HOUR_PX }}>
          {HOURS.map(h => (
            <div key={h} className="time-row" style={{ height: HOUR_PX }}>
              <span className="time-row-label">{formatHour(h)}</span>
              <button
                type="button"
                className="time-row-slot"
                onClick={() => openAddForm(selectedDate, String(h).padStart(2, '0'))}
                aria-label={`Add event at ${formatHour(h)}`}
              />
            </div>
          ))}

          {showNowLine && (
            <div className="time-now-line" style={{ top: ((nowMin - GRID_START_MIN) / 60) * HOUR_PX }}>
              <span className="time-now-dot" />
            </div>
          )}

          {dayNotes.map(note => {
            const { top, height } = gridBlockStyle(note.scheduled_time, null);
            const dimmed = !matchesSearch(note.title, note.course);
            return (
              <div
                key={note.id}
                className={`time-event priority-${note.priority} ${dimmed ? 'dimmed' : ''}`}
                style={{ top, height }}
                onClick={() => setSelectedNote(note)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter') setSelectedNote(note); }}
              >
                <span className="time-event-title">{note.title}</span>
                {height > 32 && note.course && <span className="time-event-sub">{note.course}</span>}
              </div>
            );
          })}

          {timedOutlookEvents.map(e => {
            const { top, height } = gridBlockStyle(e.scheduled_time, e.scheduled_end_time);
            const dimmed = !matchesSearch(e.title, e.location);
            return (
              <div
                key={e.id}
                className={`time-event source-outlook ${dimmed ? 'dimmed' : ''}`}
                style={{ top, height }}
                onClick={() => setSelectedOutlookEvent(e)}
                role="button"
                tabIndex={0}
                onKeyDown={ev => { if (ev.key === 'Enter') setSelectedOutlookEvent(e); }}
              >
                <span className="time-event-title">{e.title}</span>
                {height > 32 && e.location && <span className="time-event-sub">{e.location}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ============ FLOATING ADD BUTTON ============ */}
      <button type="button" className="cal-fab" onClick={() => openAddForm(selectedDate, null)} aria-label="Add event">
        <PlusIcon size={22} />
      </button>

      {/* ============ LOCAL EVENT DETAIL CARD ============ */}
      {selectedNote && (
        <div className="event-popup-overlay" onClick={() => setSelectedNote(null)}>
          <div className={`event-card priority-${selectedNote.priority}`} onClick={e => e.stopPropagation()}>
            <div className="event-card-head">
              <h4>{selectedNote.title}</h4>
              <button type="button" className="ghost icon-btn" onClick={() => setSelectedNote(null)} aria-label="Close">
                <CloseIcon size={14} />
              </button>
            </div>

            <div className="event-card-row">
              <TimerIcon size={15} />
              <span>{formatLong(new Date(selectedNote.scheduled_date + 'T00:00:00'))} · {formatClock(selectedNote.scheduled_time)}</span>
            </div>

            {selectedNote.course && (
              <div className="event-card-row">
                <BookIcon size={15} />
                <span>{selectedNote.course}</span>
              </div>
            )}

            <span className={`stamp badge-${selectedNote.priority}`} style={{ margin: '10px 0' }}>
              {PRIORITY_LABELS[selectedNote.priority] || selectedNote.priority}
            </span>

            {selectedNote.body && <p className="event-card-body">{selectedNote.body}</p>}

            <button type="button" className="ghost" onClick={() => removeNote(selectedNote.id)}>
              <TrashIcon size={13} /> Delete
            </button>
          </div>
        </div>
      )}

      {/* ============ OUTLOOK EVENT DETAIL CARD (read-only) ============ */}
      {selectedOutlookEvent && (
        <div className="event-popup-overlay" onClick={() => setSelectedOutlookEvent(null)}>
          <div className="event-card source-outlook" onClick={e => e.stopPropagation()}>
            <div className="event-card-head">
              <h4>{selectedOutlookEvent.title}</h4>
              <button type="button" className="ghost icon-btn" onClick={() => setSelectedOutlookEvent(null)} aria-label="Close">
                <CloseIcon size={14} />
              </button>
            </div>

            <div className="event-card-row">
              <TimerIcon size={15} />
              <span>
                {formatLong(new Date(selectedOutlookEvent.scheduled_date + 'T00:00:00'))}
                {selectedOutlookEvent.isAllDay ? ' · All day' : ` · ${formatClock(selectedOutlookEvent.scheduled_time)}${selectedOutlookEvent.scheduled_end_time ? ` – ${formatClock(selectedOutlookEvent.scheduled_end_time)}` : ''}`}
              </span>
            </div>

            {selectedOutlookEvent.location && (
              <div className="event-card-row">
                <MapPinIcon size={15} />
                <span>{selectedOutlookEvent.location}</span>
              </div>
            )}

            <span className="stamp badge-outlook" style={{ margin: '10px 0' }}>
              <SyncIcon size={11} /> From Outlook
            </span>

            {selectedOutlookEvent.body && <p className="event-card-body">{selectedOutlookEvent.body}</p>}

            {selectedOutlookEvent.webLink && (
              <a className="ghost" href={selectedOutlookEvent.webLink} target="_blank" rel="noreferrer" style={{ display: 'inline-flex' }}>
                Open in Outlook
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}
