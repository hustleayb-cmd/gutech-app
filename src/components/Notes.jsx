import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { CalendarIcon, NotesIcon, BookIcon, TimerIcon, TrashIcon } from './Icons';

const PRIORITY_WEIGHTS = { high: 1, medium: 2, low: 3 };
const PRIORITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' };

// "2026-08-22" + "08:00" → "Sat, Aug 22 · 8:00 AM" — one readable line
// instead of a raw ISO date and 24-hour time.
function formatSchedule(dateStr, timeStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const dateLabel = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  if (!timeStr) return dateLabel;
  const [h, m] = timeStr.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const timeLabel = `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${period}`;
  return `${dateLabel} · ${timeLabel}`;
}

export default function Notes({ userId }) {
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState('');
  const [course, setCourse] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState('low');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [open, setOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calViewDate, setCalViewDate] = useState(new Date().toISOString().split('T')[0]);
  const [err, setErr] = useState('');

  useEffect(() => { load(); }, []);

  // Live sync — a note added/edited/deleted from the Calendar tab (or
  // another device) shows up here immediately, no tab switch needed.
  useEffect(() => {
    const channel = supabase
      .channel('notes-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${userId}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  async function load() {
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

  async function add() {
    if (!title.trim() && !body.trim()) { 
      setErr('Give the note a title or some text.'); 
      return; 
    }
    if (!scheduledDate || !scheduledTime) {
      setErr('Please provide both a scheduled date and time.');
      return;
    }

    // Check for double booking at the exact same date and time slot (1-hour block)
    const targetHour = scheduledTime.split(':')[0];
    const isBusy = notes.some(n => {
      if (n.scheduled_date !== scheduledDate || !n.scheduled_time) return false;
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
      title: title.trim() || 'Untitled',
      course: course.trim(),
      body: body.trim(),
      priority: priority,
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime
    });
    
    if (error) { setErr(error.message); return; }
    
    setTitle(''); setCourse(''); setBody(''); setPriority('low'); setScheduledDate(''); setScheduledTime(''); setOpen(false);
    load();
  }

  async function remove(id) {
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) { setErr(error.message); return; }
    load();
  }

  // Generate 24-Hour slots for the selected date
  const render24HourSlots = () => {
    const slots = [];
    for (let i = 0; i < 24; i++) {
      const hourPrefix = String(i).padStart(2, '0');
      const hourStr = `${hourPrefix}:00`;
      
      const matchingNote = notes.find(n => {
        if (n.scheduled_date !== calViewDate) return false;
        if (!n.scheduled_time) return false;
        const noteHour = n.scheduled_time.split(':')[0];
        return noteHour === hourPrefix;
      });

      slots.push(
        <div key={i} className={`timeline-slot ${matchingNote ? 'booked' : 'available'}`}>
          <div className="timeline-time">{hourStr}</div>
          <div className="timeline-event-area">
            {matchingNote ? (
              <div className={`timeline-card priority-${matchingNote.priority || 'low'}`}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <span className={`stamp badge-${matchingNote.priority || 'low'}`}>{PRIORITY_LABELS[matchingNote.priority] || 'Low'}</span>
                    <h4 className="timeline-title">{matchingNote.title}</h4>
                    {matchingNote.course && <span className="event-card-row"><BookIcon size={12} /> {matchingNote.course}</span>}
                    {matchingNote.body && <p className="timeline-body">{matchingNote.body}</p>}
                  </div>
                  <button className="ghost icon-btn" onClick={() => remove(matchingNote.id)} aria-label={`Delete ${matchingNote.title}`}>
                    <TrashIcon size={13} />
                  </button>
                </div>
              </div>
            ) : (
              <span className="slot-empty-text">Open slot</span>
            )}
          </div>
        </div>
      );
    }
    return slots;
  };

  return (
    <>
      <div className="annot" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Notes & Schedule</span>
        <button className="ghost" onClick={() => setShowCalendar(!showCalendar)}>
          {showCalendar ? <><NotesIcon size={14} /> View All Notes</> : <><CalendarIcon size={14} /> 24H Timetable</>}
        </button>
      </div>

      {err && <div className="notice err">{err}</div>}

      {/* 24-HOUR TIMETABLE CALENDAR VIEW */}
      {showCalendar ? (
        <div className="card calendar-card">
          <div className="row" style={{ marginBottom: 18, alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '18px', marginBottom: 2 }}>Daily Timetable</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>24-hour schedule overview</p>
            </div>
            <input 
              type="date" 
              value={calViewDate} 
              onChange={e => setCalViewDate(e.target.value)} 
              style={{ width: '150px', margin: 0, padding: '8px 12px', fontSize: '13px' }}
            />
          </div>
          <div className="timeline-grid">
            {render24HourSlots()}
          </div>
        </div>
      ) : (
        <>
          {/* NOTE CREATION FORM */}
          {open ? (
            <div className="card">
              <label htmlFor="nt">Title</label>
              <input id="nt" value={title} onChange={e => setTitle(e.target.value)}
                     placeholder="Data Structures — week 3" />

              <label htmlFor="nc">Course (optional)</label>
              <input id="nc" value={course} onChange={e => setCourse(e.target.value)}
                     placeholder="CS 2210" />

              <label htmlFor="sd">Scheduled Date *</label>
              <input id="sd" type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} required />

              <label htmlFor="st">Scheduled Time *</label>
              <input id="st" type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} required />

              <label htmlFor="np">Priority</label>
              <select id="np" value={priority} onChange={e => setPriority(e.target.value)}>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>

              <label htmlFor="nb">Note</label>
              <textarea id="nb" value={body} onChange={e => setBody(e.target.value)}
                        placeholder="What you want to remember…" />

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="primary" onClick={add}>Save note</button>
                <button className="ghost" onClick={() => { setOpen(false); setErr(''); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="primary" onClick={() => setOpen(true)}>Write a note</button>
          )}

          {notes.length === 0 && !open && (
            <div className="empty" style={{ marginTop: 14 }}>
              <div className="k">Nothing saved yet</div>
              <p>Notes you write here stay on your account and sync to any device you sign in on.</p>
            </div>
          )}

          {/* NOTES LIST */}
          <div style={{ marginTop: 14 }}>
            {notes.map(n => (
              <div className={`card priority-${n.priority || 'low'}`} key={n.id}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <h3>{n.title}</h3>
                  <button className="ghost icon-btn" onClick={() => remove(n.id)} aria-label={`Delete ${n.title}`}>
                    <TrashIcon size={14} />
                  </button>
                </div>

                <span className={`stamp badge-${n.priority || 'low'}`}>{PRIORITY_LABELS[n.priority] || 'Low'}</span>

                <div className="note-meta">
                  {n.course && (
                    <span className="event-card-row"><BookIcon size={13} /> {n.course}</span>
                  )}
                  {n.scheduled_date && (
                    <span className="event-card-row"><TimerIcon size={13} /> {formatSchedule(n.scheduled_date, n.scheduled_time)}</span>
                  )}
                </div>

                {n.body && <p>{n.body}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}