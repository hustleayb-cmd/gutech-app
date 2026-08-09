import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { BellIcon, MegaphoneIcon, BookIcon, IdCardIcon, GlobeIcon, InstagramIcon } from './Icons';
import AnnouncementArt from './AnnouncementArt';
import Motivation from './Motivation';

// External systems students actually need quick access to, not internal
// tabs — those already have their own bottom-nav buttons.
const QUICK_LINKS = [
  { href: 'https://moodle.gutech.edu.om/login/index.php', label: 'Moodle', Icon: BookIcon },
  { href: 'https://eduwave.gutech.edu.om/EduwaveHE/Login.aspx', label: 'EduWave', Icon: IdCardIcon },
  { href: 'https://www.gutech.edu.om', label: 'Website', Icon: GlobeIcon },
  { href: 'https://www.instagram.com/gutech_oman?igsh=MTduM3F0dmFybWM5cg==', label: 'Instagram', Icon: InstagramIcon },
];

export default function Home({ who, onNavigate }) {
  const [due, setDue] = useState([]);
  const [announcement, setAnnouncement] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const [r, a] = await Promise.all([
      supabase.from('reminders').select('*').eq('done', false).order('due_at', { ascending: true }).limit(3),
      supabase.from('announcements').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(1),
    ]);
    if (r.error) setErr(r.error.message);
    setDue(r.data ?? []);
    setAnnouncement(a.data?.[0] ?? null);
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

      <Motivation />

      <div className="annot">Quick links</div>
      <div className="quick-links">
        {QUICK_LINKS.map(({ href, label, Icon }) => (
          <a key={href} className="quick-link" href={href} target="_blank" rel="noopener noreferrer">
            <Icon size={20} />
            <span>{label}</span>
          </a>
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
            <AnnouncementArt category={announcement.category} seedKey={announcement.id ?? announcement.title} />
            <div className="announcement-card-body">
              <div className="row" style={{ gap: 8, justifyContent: 'flex-start' }}>
                <MegaphoneIcon size={16} />
                <h3 style={{ fontSize: 15 }}>{announcement.title}</h3>
              </div>
              {announcement.body && <p>{announcement.body}</p>}
            </div>
          </div>
        </>
      )}
    </>
  );
}
