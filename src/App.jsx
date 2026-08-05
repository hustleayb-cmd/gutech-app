import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import Auth from './components/Auth';
import Chat from './components/Chat';
import Calendar from './components/Calendar';
import Notes from './components/Notes';
import Reminders from './components/Reminders';
import Home from './components/Home';
import Grades from './components/Grades';
import StudyRoom from './components/StudyRoom';
import Projects from './components/Projects';
import Clubs from './components/Clubs';
import Announcements from './components/Announcements';
import Campus from './components/Campus';
import Profile from './components/Profile';
import More from './components/More';
import Logo from './components/Logo';
import { HomeIcon, AskIcon, CalendarIcon, NotesIcon, MoreIcon } from './components/Icons';

// Only these five live in the bottom bar (Nielsen/Apple guidance caps it at
// five); everything else — Due, Grades, Announcements, Campus, Profile —
// lives one tap away behind "More" so the bar never gets overloaded.
const PRIMARY_TABS = [
  { tab: 'home', label: 'Home', Icon: HomeIcon },
  { tab: 'ask', label: 'Ask', Icon: AskIcon },
  { tab: 'calendar', label: 'Calendar', Icon: CalendarIcon },
  { tab: 'notes', label: 'Notes', Icon: NotesIcon },
];
const SECONDARY_TABS = new Set(['study', 'projects', 'due', 'grades', 'clubs', 'announcements', 'campus', 'profile']);

export default function App() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('home');
  const [pending, setPending] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Keep the nav badge accurate even when the Due tab (which normally
  // reports its own count via onCount) hasn't been visited yet this session.
  useEffect(() => {
    if (!session) return;
    supabase.from('reminders').select('id', { count: 'exact', head: true }).eq('done', false)
      .then(({ count }) => { if (typeof count === 'number') setPending(count); });
  }, [session]);

  if (!ready) return <div className="app" />;
  if (!session) return <div className="app"><Auth /></div>;

  const uid = session.user.id;
  const email = session.user.email ?? '';
  const who = email.split('@')[0] ?? 'student';

  function goTo(nextTab) {
    setTab(nextTab);
    setMoreOpen(false);
  }

  const activeInMore = SECONDARY_TABS.has(tab);

  return (
    <div className="app">
      <header className="titleblock">
        <Logo size="sm" />
        <div className="header-right">
          <span className="meta">{who}</span>
        </div>
      </header>

      <main>
        {tab === 'home' && <Home who={who} onNavigate={goTo} />}
        {tab === 'ask' && <Chat userId={uid} />}
        {tab === 'calendar' && <Calendar userId={uid} />}
        {tab === 'notes' && <Notes userId={uid} />}
        {tab === 'due' && <Reminders userId={uid} onCount={setPending} />}
        {tab === 'grades' && <Grades userId={uid} />}
        {tab === 'study' && <StudyRoom />}
        {tab === 'projects' && <Projects userId={uid} email={email} />}
        {tab === 'clubs' && <Clubs userId={uid} email={email} onNavigate={goTo} />}
        {tab === 'announcements' && <Announcements />}
        {tab === 'campus' && <Campus />}
        {tab === 'profile' && <Profile userId={uid} email={email} />}
      </main>

      <nav>
        {PRIMARY_TABS.map(({ tab: t, label, Icon }) => (
          <button key={t} data-on={tab === t ? '1' : '0'} onClick={() => goTo(t)}>
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
        <button data-on={activeInMore || moreOpen ? '1' : '0'} onClick={() => setMoreOpen(true)}>
          <MoreIcon size={18} />
          <span>More</span>
          {pending > 0 && <span className="count nav-count">{pending}</span>}
        </button>
      </nav>

      {moreOpen && <More onNavigate={goTo} onClose={() => setMoreOpen(false)} pending={pending} />}
    </div>
  );
}
