// Hand-rolled line icons — no emoji, no extra dependency to install.
// One consistent stroke (1.75, round caps/joins) across the whole set so
// the icon language stays uniform everywhere it's used.
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function Icon({ children, size = 20, className, label }) {
  return (
    <svg {...base} width={size} height={size} className={className}
         role={label ? 'img' : 'presentation'} aria-hidden={label ? undefined : true}
         aria-label={label}>
      {children}
    </svg>
  );
}

export const HomeIcon = (p) => <Icon {...p}><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" /></Icon>;
export const AskIcon = (p) => <Icon {...p}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-8Z" /><path d="M8 8.5h8M8 11.5h5" /></Icon>;
export const CalendarIcon = (p) => <Icon {...p}><rect x="3.5" y="5" width="17" height="16" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></Icon>;
export const NotesIcon = (p) => <Icon {...p}><path d="M6 3.5h9l3.5 3.5V20a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5Z" /><path d="M15 3.5V7h3.5" /><path d="M8 12h8M8 15.5h5" /></Icon>;
export const MoreIcon = (p) => <Icon {...p}><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></Icon>;
export const BellIcon = (p) => <Icon {...p}><path d="M6 10a6 6 0 1 1 12 0c0 3.2 1 4.6 1.6 5.4a.9.9 0 0 1-.7 1.6H5.1a.9.9 0 0 1-.7-1.6C5 14.6 6 13.2 6 10Z" /><path d="M10 19.5a2 2 0 0 0 4 0" /></Icon>;
export const ChartIcon = (p) => <Icon {...p}><path d="M4 20V10M11 20V4M18 20v-6" /><path d="M2.5 20h19" /></Icon>;
export const MegaphoneIcon = (p) => <Icon {...p}><path d="M3.5 10.5v3a1 1 0 0 0 1 1H6l1.2 4.4a1 1 0 0 0 1 .7h1a1 1 0 0 0 1-1.2L9 14.5" /><path d="M4.5 10.5 15 6.2A2 2 0 0 1 18 8v8a2 2 0 0 1-3 1.7l-10.5-4.4a1 1 0 0 1 0-2.8Z" /><path d="M18 9.5c1.2.5 2 1.5 2 2.5s-.8 2-2 2.5" /></Icon>;
export const MapPinIcon = (p) => <Icon {...p}><path d="M12 21s7-6.6 7-11.8A7 7 0 0 0 5 9.2C5 14.4 12 21 12 21Z" /><circle cx="12" cy="9.2" r="2.4" /></Icon>;
export const UserIcon = (p) => <Icon {...p}><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20c1-3.6 4-5.5 7.5-5.5s6.5 1.9 7.5 5.5" /></Icon>;
export const SignOutIcon = (p) => <Icon {...p}><path d="M9 20H5.5A1.5 1.5 0 0 1 4 18.5v-13A1.5 1.5 0 0 1 5.5 4H9" /><path d="M16 16l4-4-4-4M20 12H9" /></Icon>;
export const CloseIcon = (p) => <Icon {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>;
export const ChevronLeft = (p) => <Icon {...p}><path d="M15 5l-7 7 7 7" /></Icon>;
export const ChevronRight = (p) => <Icon {...p}><path d="M9 5l7 7-7 7" /></Icon>;
export const PlusIcon = (p) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>;
export const CheckIcon = (p) => <Icon {...p}><path d="M4.5 12.5l5 5 10-11" /></Icon>;
export const TrashIcon = (p) => <Icon {...p}><path d="M4.5 7h15M9.5 7V4.8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7M7 7l.7 12a1.5 1.5 0 0 0 1.5 1.4h5.6a1.5 1.5 0 0 0 1.5-1.4L17 7" /></Icon>;
export const BookIcon = (p) => <Icon {...p}><path d="M4.5 5.2A1.2 1.2 0 0 1 5.7 4H12v16H5.7a1.2 1.2 0 0 1-1.2-1.2z" /><path d="M19.5 5.2A1.2 1.2 0 0 0 18.3 4H12v16h6.3a1.2 1.2 0 0 0 1.2-1.2z" /></Icon>;
export const PinIcon = (p) => <Icon {...p}><path d="M12 2.5 15 8l5.5 1-4 4 1 5.5-5.5-3-5.5 3 1-5.5-4-4L8 8Z" /></Icon>;
export const IdCardIcon = (p) => <Icon {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="11" r="2" /><path d="M6 16c.5-1.5 1.7-2.3 2.5-2.3s2 .8 2.5 2.3M14 9.5h4M14 12.5h4M14 15.5h2.5" /></Icon>;
export const PhoneIcon = (p) => <Icon {...p}><path d="M6 3.5h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a1.5 1.5 0 0 1-1.6 1.5A15.5 15.5 0 0 1 4.5 5.1 1.5 1.5 0 0 1 6 3.5Z" /></Icon>;
export const InstagramIcon = (p) => <Icon {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="16.8" cy="7.2" r="1" fill="currentColor" stroke="none" /></Icon>;

// ---- Club category icons ----
export const TrophyIcon = (p) => <Icon {...p}><path d="M7 4h10v4.5a5 5 0 0 1-10 0V4Z" /><path d="M7 5.5H4v1.5a3 3 0 0 0 3 3M17 5.5h3v1.5a3 3 0 0 1-3 3" /><path d="M12 13.5V17M9 20.5h6M9.5 17h5l.7 3.5h-6.4z" /></Icon>;
export const CodeIcon = (p) => <Icon {...p}><path d="M9 8 4.5 12 9 16M15 8l4.5 4-4.5 4M13 5.5l-2 13" /></Icon>;
export const PaletteIcon = (p) => <Icon {...p}><path d="M12 4a8 8 0 1 0 0 16h1.2a1.6 1.6 0 0 0 1.2-2.7 1.6 1.6 0 0 1 1.2-2.7H17a3 3 0 0 0 3-3A8 8 0 0 0 12 4Z" /><circle cx="8" cy="11" r="1.1" fill="currentColor" stroke="none" /><circle cx="11.5" cy="8" r="1.1" fill="currentColor" stroke="none" /><circle cx="15.5" cy="9.5" r="1.1" fill="currentColor" stroke="none" /></Icon>;
export const MusicIcon = (p) => <Icon {...p}><path d="M9 18a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" /><path d="M17 16.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" /><path d="M11.5 13V5.5L19.5 4v7.5" /></Icon>;
export const BriefcaseIcon = (p) => <Icon {...p}><rect x="3.5" y="8" width="17" height="11" rx="2" /><path d="M9 8V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v2M3.5 13h17" /></Icon>;
export const GlobeIcon = (p) => <Icon {...p}><circle cx="12" cy="12" r="8" /><path d="M4 12h16M12 4c2.2 2.2 3.3 5 3.3 8s-1.1 5.8-3.3 8c-2.2-2.2-3.3-5-3.3-8S9.8 6.2 12 4Z" /></Icon>;
export const HeartIcon = (p) => <Icon {...p}><path d="M12 20s-7.5-4.6-9.5-9.3C1.3 7.5 3 4.5 6.3 4.5c1.9 0 3.4 1 4.7 2.6 1.3-1.6 2.8-2.6 4.7-2.6 3.3 0 5 3 3.8 6.2C19.5 15.4 12 20 12 20Z" /></Icon>;
export const UsersIcon = (p) => <Icon {...p}><circle cx="9" cy="8" r="3" /><path d="M3 20c.7-3.3 2.9-5 6-5s5.3 1.7 6 5" /><path d="M15.5 5.5a3 3 0 0 1 0 5.8M21 20c-.5-2.4-1.7-4-3.7-4.7" /></Icon>;

// ---- Study Room icons ----
export const TimerIcon = (p) => <Icon {...p}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9.5 2.5h5M12 2.5V4.5" /></Icon>;
export const PlayIcon = (p) => <Icon {...p}><path d="M6.5 4.8v14.4a1 1 0 0 0 1.53.85l11.3-7.2a1 1 0 0 0 0-1.7l-11.3-7.2a1 1 0 0 0-1.53.85Z" /></Icon>;
export const PauseIcon = (p) => <Icon {...p}><rect x="5.5" y="4.5" width="4.5" height="15" rx="1" /><rect x="14" y="4.5" width="4.5" height="15" rx="1" /></Icon>;
export const StopIcon = (p) => <Icon {...p}><rect x="5" y="5" width="14" height="14" rx="2.5" /></Icon>;
export const ResetIcon = (p) => <Icon {...p}><path d="M4.5 12a7.5 7.5 0 1 1 2.3 5.4" /><path d="M4.5 17v-4.5H9" /></Icon>;
export const SoundIcon = (p) => <Icon {...p}><path d="M4.5 10v4a1 1 0 0 0 1 1h2.7l4.3 3.6a.6.6 0 0 0 1-.46V5.86a.6.6 0 0 0-1-.46L8.2 9H5.5a1 1 0 0 0-1 1Z" /><path d="M16.5 9.5c.9.7 1.5 1.7 1.5 2.9s-.6 2.2-1.5 2.9M19 7.5c1.5 1.2 2.5 3 2.5 5s-1 3.8-2.5 5" /></Icon>;
export const BoardIcon = (p) => <Icon {...p}><rect x="3.5" y="4" width="17" height="16" rx="2" /><path d="M8.5 4v16M15.5 4v16M6 8h1.2M6 11h1.2M17.2 8h1M17.2 11h1M17.2 14h1" /></Icon>;
export const SparkleIcon = (p) => <Icon {...p}><path d="M12 3.5 13.4 9l5.6 1.4-5.6 1.4L12 17.5l-1.4-5.7L5 10.4 10.6 9Z" /><path d="M19 3.5l.6 2 2 .6-2 .6-.6 2-.6-2-2-.6 2-.6ZM5 16l.5 1.7 1.7.5-1.7.5L5 20.5l-.5-1.8-1.7-.5 1.7-.5Z" /></Icon>;
export const StreakIcon = (p) => <Icon {...p}><path d="M12 2.5c1.5 3 .5 4.5-.5 6-1.5 2-3 3.5-3 6.3A5.5 5.5 0 0 0 14 20a5 5 0 0 0 1.6-9.7c.2 1.3-.2 2.2-1 2.7.4-2.6-.4-4-1.6-5.4-.3 1-1 1.6-1.9 1.3.3-2-.2-3.8.9-6.4Z" /></Icon>;
export const ChatBubbleIcon = (p) => <Icon {...p}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7A2.5 2.5 0 0 1 17.5 15H9l-3.5 3.2V15H6.5A2.5 2.5 0 0 1 4 12.5Z" /></Icon>;
