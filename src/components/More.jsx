import { supabase } from '../supabase';
import { BellIcon, ChartIcon, MegaphoneIcon, MapPinIcon, UserIcon, UsersIcon, SignOutIcon, CloseIcon, TimerIcon } from './Icons';

const ITEMS = [
  { tab: 'study', label: 'Study Room', hint: 'Focus timer', Icon: TimerIcon },
  { tab: 'due', label: 'Due', hint: 'Assignments & deadlines', Icon: BellIcon },
  { tab: 'grades', label: 'Grades', hint: 'Courses & GPA', Icon: ChartIcon },
  { tab: 'clubs', label: 'Clubs', hint: 'Join a club', Icon: UsersIcon },
  { tab: 'announcements', label: 'Announcements', hint: 'Campus news', Icon: MegaphoneIcon },
  { tab: 'campus', label: 'Campus', hint: 'Map & services', Icon: MapPinIcon },
  { tab: 'profile', label: 'Profile', hint: 'Your student ID', Icon: UserIcon },
];

export default function More({ onNavigate, onClose, pending }) {
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="row" style={{ marginBottom: 6 }}>
          <h3 style={{ fontSize: 16 }}>More</h3>
          <button className="ghost icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="sheet-grid">
          {ITEMS.map(({ tab, label, hint, Icon }) => (
            <button key={tab} className="sheet-item" onClick={() => onNavigate(tab)}>
              <span className="sheet-item-icon">
                <Icon size={22} />
                {tab === 'due' && pending > 0 && <span className="count sheet-item-count">{pending}</span>}
              </span>
              <span className="sheet-item-label">{label}</span>
              <span className="sheet-item-hint">{hint}</span>
            </button>
          ))}
        </div>

        <button className="sheet-signout" onClick={() => supabase.auth.signOut()}>
          <SignOutIcon size={17} />
          Sign out
        </button>
      </div>
    </div>
  );
}
