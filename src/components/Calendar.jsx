import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

const PRIORITY_WEIGHTS = { high: 1, medium: 2, low: 3 };
const PRIORITY_LABELS = { high: '🔥 High', medium: '⚡ Medium', low: '🌱 Low' };

// Visible hour range for the week grid — trimmed to a normal school day
// so the grid stays compact and doesn't overwhelm the student. Adjust freely.
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

function formatShort(d) {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function Calendar({ userId }) {
  const [notes, setNotes] = useState([]);
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [search, setSearch] = useState('');

  // Inline "add event" form state (opened by clicking an empty grid cell)
  const [isAdding, setIsAdding] = useState(false);
  const [activeDate, setActiveDate] = useState(null);
  const [title, setTitle] = useState('');
  const [course, setCourse] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState('low');
  const [scheduledTime, setScheduledTime] = useState('');
  const [err, setErr] = useState('');

  // Detail popup state (opened by clicking a filled event block)
  const [selectedNote, setSelectedNote] = useState(null);

  useEffect(() => { loadNotes(); }, []);

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

  // Same 1-hour double-booking check as before, now scoped per grid cell (date + hour)
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

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const todayStr = toISODate(new Date());
  const weekRangeLabel = `${formatShort(weekDays[0])} – ${formatShort(weekDays[6])}, ${weekDays[6].getFullYear()}`;

  function goPrevWeek() { setWeekStart(d => { const nd = new Date(d); nd.setDate(nd.getDate() - 7); return nd; }); }
  function goNextWeek() { setWeekStart(d => { const nd = new Date(d); nd.setDate(nd.getDate() + 7); return nd; }); }
  function goToday() { setWeekStart(getMonday(new Date())); }

  return (
    <>
      <div className="annot" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span>Weekly Schedule</span>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter by course or title..."
          style={{ width: '150px', margin: 0, padding: '10px 14px', fontSize: '12px' }}
        />
      </div>

      <div className="row" style={{ justifyContent: 'center', gap: 12, alignItems: 'center', margin: '10px 0' }}>
        <button type="button" className="ghost icon-btn" onClick={goPrevWeek} aria-label="Previous week">‹</button>
        <span style={{ fontSize: '13px', fontWeight: 600, minWidth: 140, textAlign: 'center' }}>{weekRangeLabel}</span>
        <button type="button" className="ghost icon-btn" onClick={goNextWeek} aria-label="Next week">›</button>
        <button type="button" className="ghost" onClick={goToday}>Today</button>
      </div>

      <div className="row" style={{ justifyContent: 'center', gap: 16, marginBottom: 14 }}>
        {Object.keys(PRIORITY_LABELS).map(key => (
          <span key={key} className={`legend-dot priority-${key}`}>{PRIORITY_LABELS[key]}</span>
        ))}
      </div>

      {err && <div className="notice err">{err}</div>}

      {isAdding && (
        <div className="card" style={{ borderColor: 'var(--accent-primary)', marginBottom: 16 }}>
          <div className="row" style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: '15px' }}>Add Event for {activeDate} at {scheduledTime}</h3>
            <button type="button" className="ghost" onClick={closeAddForm}>Cancel</button>
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

          <button type="button" className="primary" onClick={handleAddEvent}>Confirm & Book Slot</button>
        </div>
      )}

      <div className="card week-calendar-card">
        <div className="week-grid-scroll">
          <div className="week-grid">
            <div className="week-corner" />
            {weekDays.map((d, i) => (
              <div key={i} className={`week-day-header ${toISODate(d) === todayStr ? 'is-today' : ''}`}>
                <div className="week-day-name">{DAY_LABELS[i]}</div>
                <div className="week-day-num">{d.getDate()}</div>
              </div>
            ))}

            {HOURS.map(h => {
              const hourPrefix = String(h).padStart(2, '0');
              const hourLabel = `${hourPrefix}:00`;
              return (
                <div key={h} style={{ display: 'contents' }}>
                  <div className="week-hour-label">{hourLabel}</div>
                  {weekDays.map((d, i) => {
                    const dateStr = toISODate(d);
                    const note = getNoteFor(dateStr, hourPrefix);

                    if (!note) {
                      return (
                        <button
                          type="button"
                          key={i}
                          className="week-cell empty"
                          onClick={() => openAddForm(dateStr, hourPrefix)}
                          aria-label={`Add event ${DAY_LABELS[i]} ${d.getDate()} at ${hourLabel}`}
                        >
                          <span className="week-cell-plus">+</span>
                        </button>
                      );
                    }

                    const dimmed = !matchesSearch(note);
                    return (
                      <div
                        key={i}
                        className={`week-cell filled priority-${note.priority} ${dimmed ? 'dimmed' : ''}`}
                        onClick={() => setSelectedNote(note)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => { if (e.key === 'Enter') setSelectedNote(note); }}
                      >
                        <span className="week-event-dot" />
                        <span className="week-event-title">{note.title}</span>
                        {note.course && <span className="week-event-course">{note.course}</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
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
              <button type="button" className="ghost icon-btn" onClick={() => setSelectedNote(null)} aria-label="Close">✕</button>
            </div>

            <span className={`stamp badge-${selectedNote.priority}`}>
              {PRIORITY_LABELS[selectedNote.priority] || selectedNote.priority}
            </span>

            {selectedNote.body && <p className="event-popup-body">{selectedNote.body}</p>}

            <button type="button" className="ghost" onClick={() => removeNote(selectedNote.id)}>Delete</button>
          </div>
        </div>
      )}
    </>
  );
}