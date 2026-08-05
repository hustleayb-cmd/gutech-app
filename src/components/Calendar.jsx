import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { ChevronLeft, ChevronRight, PlusIcon, CloseIcon, TrashIcon, BellIcon, CheckIcon } from './Icons';

const PRIORITY_WEIGHTS = { high: 1, medium: 2, low: 3 };
const PRIORITY_LABELS = { high: '🔥 High', medium: '⚡ Medium', low: '🌱 Low' };
const PRIORITY_ORDER = ['high', 'medium', 'low'];

// Visible hour range for the day agenda — trimmed to a normal school day.
const START_HOUR = 7;   // 7 AM
const END_HOUR = 22;    // 10 PM
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

function formatLong(d) {
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
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
  const [view, setView] = useState('week'); // 'week' | 'month'
  // The single source of truth for "where you are" — the week strip and
  // month grid both derive their visible range from this.
  const [selectedDate, setSelectedDate] = useState(() => toISODate(new Date()));
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [search, setSearch] = useState('');

  // Inline "add event" form state (opened by tapping a free gap in the day)
  const [isAdding, setIsAdding] = useState(false);
  const [activeDate, setActiveDate] = useState(null);
  const [title, setTitle] = useState('');
  const [course, setCourse] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState('low');
  const [scheduledTime, setScheduledTime] = useState('');
  const [err, setErr] = useState('');

  // Detail popup state (opened by tapping an event card)
  const [selectedNote, setSelectedNote] = useState(null);

  useEffect(() => { loadNotes(); loadReminders(); }, []);

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
    setScheduledTime(`${hourPrefix}:00`);
    setIsAdding(true);
  }

  function closeAddForm() {
    setIsAdding(false);
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
    const { error } = await supabase.from('notes').insert({
      user_id: userId,
      title: title.trim() || 'Untitled Event',
      course: course.trim(),
      body: body.trim(),
      priority: priority,
      scheduled_date: activeDate,
      scheduled_time: scheduledTime
    });

    if (error) { setErr(error.message); return; }

    setTitle(''); setCourse(''); setBody(''); setPriority('low'); setScheduledTime('');
    setIsAdding(false); setActiveDate(null);
    loadNotes();
  }

  async function removeNote(id) {
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) { setErr(error.message); return; }
    setSelectedNote(null);
    loadNotes();
  }

  function matchesSearch(note) {
    if (!search.trim()) return true;
    const s = search.trim().toLowerCase();
    return note.title.toLowerCase().includes(s) || (note.course || '').toLowerCase().includes(s);
  }

  function getNoteFor(dateStr, hourPrefix) {
    return notes.find(n => n.scheduled_date === dateStr && n.scheduled_time && n.scheduled_time.split(':')[0] === hourPrefix);
  }

  function remindersFor(dateStr) {
    return reminders.filter(r => toISODate(new Date(r.due_at)) === dateStr);
  }

  // Which priority colors show up on a given day — notes AND reminders
  // both feed this, so the dots mean the same thing everywhere they appear
  // (week strip, month grid).
  function dotsFor(dateStr) {
    const present = new Set(notes.filter(n => n.scheduled_date === dateStr).map(n => n.priority));
    remindersFor(dateStr).forEach(r => { const u = reminderUrgency(r); if (u) present.add(u); });
    return PRIORITY_ORDER.filter(p => present.has(p));
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

  // Month grid — adaptive row count (5 or 6 weeks), Monday-first, like the
  // Apple Calendar month view this was modelled on.
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

  // Build the day's timeline as alternating "event" and "gap" segments —
  // gaps collapse to one slim row instead of an empty row per hour, so a
  // student sees the whole day without scrolling past dead space.
  const segments = [];
  {
    let i = 0;
    while (i < HOURS.length) {
      const hourPrefix = String(HOURS[i]).padStart(2, '0');
      const note = getNoteFor(selectedDate, hourPrefix);
      if (note) {
        segments.push({ type: 'event', hour: HOURS[i], note });
        i++;
      } else {
        let j = i;
        while (j < HOURS.length && !getNoteFor(selectedDate, String(HOURS[j]).padStart(2, '0'))) j++;
        segments.push({ type: 'gap', startHour: HOURS[i], endHour: HOURS[j - 1] });
        i = j;
      }
    }
  }

  const dueToday = remindersFor(selectedDate);

  return (
    <>
      <div className="annot" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span>Calendar</span>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter by course or title..."
          style={{ width: '150px', margin: 0, padding: '10px 14px', fontSize: '12px' }}
        />
      </div>

      <div className="chip-row" style={{ marginBottom: 14 }}>
        <button className={`chip ${view === 'week' ? 'chip-on' : ''}`} onClick={() => setView('week')}>Week</button>
        <button className={`chip ${view === 'month' ? 'chip-on' : ''}`} onClick={() => setView('month')}>Month</button>
      </div>

      {err && <div className="notice err">{err}</div>}

      {view === 'week' ? (
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
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
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
            {DAY_LABELS.map(d => <span key={d}>{d}</span>)}
          </div>

          <div className="month-cells">
            {monthCells.map((d, i) => {
              const dateStr = toISODate(d);
              const inMonth = d.getMonth() === monthCursor.getMonth();
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              const dots = dotsFor(dateStr);
              return (
                <button
                  key={i}
                  type="button"
                  className={`month-cell ${!inMonth ? 'is-outside' : ''} ${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}`}
                  onClick={() => selectDayInMonth(d)}
                  aria-label={d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                >
                  <span className="month-cell-num">{d.getDate()}</span>
                  <span className="month-cell-dots">
                    {dots.map(p => <span key={p} className={`strip-dot priority-${p}`} />)}
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

      {isAdding && (
        <div className="card" style={{ borderColor: 'var(--accent-primary)', marginBottom: 16 }}>
          <div className="row" style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: 15 }}>Add event — {activeDate} at {scheduledTime}</h3>
            <button type="button" className="ghost icon-btn" onClick={closeAddForm} aria-label="Cancel">
              <CloseIcon size={14} />
            </button>
          </div>

          <label htmlFor="et">Title</label>
          <input id="et" value={title} onChange={e => setTitle(e.target.value)} placeholder="Lecture, Study Session..." />

          <label htmlFor="ec">Course (optional)</label>
          <input id="ec" value={course} onChange={e => setCourse(e.target.value)} placeholder="CS 2210" />

          <label htmlFor="es">Time (1-hour block)</label>
          <input id="es" type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} />

          <label htmlFor="ep">Priority</label>
          <select id="ep" value={priority} onChange={e => setPriority(e.target.value)}>
            <option value="high">🔥 High Priority</option>
            <option value="medium">⚡ Medium Priority</option>
            <option value="low">🌱 Low Priority</option>
          </select>

          <label htmlFor="eb">Description</label>
          <textarea id="eb" value={body} onChange={e => setBody(e.target.value)} placeholder="Additional notes..." />

          <button type="button" className="primary" onClick={handleAddEvent}>Confirm & book slot</button>
        </div>
      )}

      {/* ============ SELECTED DAY DETAIL ============ */}
      <div className="annot">{formatLong(selectedDateObj)}</div>

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

      <div className="agenda">
        {segments.map((seg, idx) => {
          if (seg.type === 'event') {
            const { note, hour } = seg;
            const dimmed = !matchesSearch(note);
            return (
              <div
                key={idx}
                className={`agenda-event priority-${note.priority} ${dimmed ? 'dimmed' : ''}`}
                onClick={() => setSelectedNote(note)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter') setSelectedNote(note); }}
              >
                <span className="agenda-event-time">{formatHour(hour)}</span>
                <div className="agenda-event-body">
                  <span className="agenda-event-title">{note.title}</span>
                  {note.course && <span className="agenda-event-course">{note.course}</span>}
                </div>
                <span className={`stamp badge-${note.priority} agenda-event-stamp`}>{note.priority}</span>
              </div>
            );
          }

          const span = seg.endHour - seg.startHour + 1;
          return (
            <button
              key={idx}
              type="button"
              className="agenda-gap"
              onClick={() => openAddForm(selectedDate, String(seg.startHour).padStart(2, '0'))}
              aria-label={`Add event between ${formatHour(seg.startHour)} and ${formatHour(seg.endHour)}`}
            >
              <PlusIcon size={13} />
              <span>{formatHour(seg.startHour)}{span > 1 ? ` – ${formatHour(seg.endHour)}` : ''} · free</span>
            </button>
          );
        })}
      </div>

      {selectedNote && (
        <div className="event-popup-overlay" onClick={() => setSelectedNote(null)}>
          <div className="event-popup" onClick={e => e.stopPropagation()}>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div>
                <h4 style={{ margin: 0 }}>{selectedNote.title}</h4>
                <div className="event-popup-subtitle">
                  {selectedNote.scheduled_date} • {selectedNote.scheduled_time}
                  {selectedNote.course ? ` • ${selectedNote.course}` : ''}
                </div>
              </div>
              <button type="button" className="ghost icon-btn" onClick={() => setSelectedNote(null)} aria-label="Close">
                <CloseIcon size={14} />
              </button>
            </div>

            <span className={`stamp badge-${selectedNote.priority}`}>
              {PRIORITY_LABELS[selectedNote.priority] || selectedNote.priority}
            </span>

            {selectedNote.body && <p className="event-popup-body">{selectedNote.body}</p>}

            <button type="button" className="ghost" onClick={() => removeNote(selectedNote.id)}>
              <TrashIcon size={13} /> Delete
            </button>
          </div>
        </div>
      )}
    </>
  );
}
