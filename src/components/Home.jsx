import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { computeGPA } from '../lib/gpa';
import { BellIcon, ChartIcon, MegaphoneIcon, AskIcon, CalendarIcon, NotesIcon } from './Icons';

const QUICK_LINKS = [
  { tab: 'ask', label: 'Ask', Icon: AskIcon },
  { tab: 'calendar', label: 'Calendar', Icon: CalendarIcon },
  { tab: 'notes', label: 'Notes', Icon: NotesIcon },
  { tab: 'grades', label: 'Grades', Icon: ChartIcon },
];

export default function Home({ who, onNavigate }) {
  const [due, setDue] = useState([]);
  const [announcement, setAnnouncement] = useState(null);
  const [gpa, setGpa] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const [r, a, g] = await Promise.all([
      supabase.from('reminders').select('*').eq('done', false).order('due_at', { ascending: true }).limit(3),
      supabase.from('announcements').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(1),
      supabase.from('grades').select('grade, credit_hours'),
    ]);
    if (r.error) setErr(r.error.message);
    setDue(r.data ?? []);
    setAnnouncement(a.data?.[0] ?? null);
    setGpa(g.data ? computeGPA(g.data) : null);
  }

  const fmt = t => new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <>
      <div className="home-greeting">
        <h2>{greeting}, {who}</h2>
        <p>Here's what's happening at GUtech today.</p>
      </div>

      {err && <div className="notice err">{err}</div>}

      <div className="home-stats">
        <div className="card home-stat-card">
          <div className="home-stat-icon"><BellIcon size={18} /></div>
          <span className="home-stat-num">{due.length}</span>
          <span className="home-stat-label">Due soon</span>
        </div>
        <div className="card home-stat-card">
          <div className="home-stat-icon"><ChartIcon size={18} /></div>
          <span className="home-stat-num">{gpa && gpa.hours > 0 ? gpa.gpa.toFixed(2) : '—'}</span>
          <span className="home-stat-label">GPA</span>
        </div>
      </div>

      <div className="annot">Quick links</div>
      <div className="quick-links">
        {QUICK_LINKS.map(({ tab, label, Icon }) => (
          <button key={tab} className="quick-link" onClick={() => onNavigate(tab)}>
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="annot">Coming up</div>
      {due.length === 0 ? (
        <div className="empty">
          <div className="k"><BellIcon size={14} /> All clear</div>
          <p>Nothing due right now. Add a reminder from the More menu when something comes up.</p>
        </div>
      ) : (
        due.map(r => (
          <div className="card" key={r.id} onClick={() => onNavigate('due')} role="button" tabIndex={0}>
            <div className="row">
              <h3 style={{ fontSize: 15 }}>{r.title}</h3>
              <span className="stamp badge-neutral">{fmt(r.due_at)}</span>
            </div>
          </div>
        ))
      )}

      {announcement && (
        <>
          <div className="annot">Latest announcement</div>
          <div className={`card announcement-card cat-${announcement.category}`} onClick={() => onNavigate('announcements')} role="button" tabIndex={0}>
            <div className="row" style={{ gap: 8, justifyContent: 'flex-start' }}>
              <MegaphoneIcon size={16} />
              <h3 style={{ fontSize: 15 }}>{announcement.title}</h3>
            </div>
            {announcement.body && <p>{announcement.body}</p>}
          </div>
        </>
      )}
    </>
  );
}
