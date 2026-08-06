// A small custom icon set for the Course Planner, distinct from the
// app-wide generic outline set in Icons.jsx — these lean into subject
// matter (a stack for "hierarchy", a platter for "disk") and a slightly
// looser, hand-set line quality (irregular curve handles instead of
// perfect circles) so they read as illustrated rather than iconography-
// kit generic.
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};
const Icon = ({ size = 20, children, ...rest }) => (
  <svg width={size} height={size} {...base} {...rest}>{children}</svg>
);

export const StackIcon = (p) => <Icon {...p}><path d="M4 7.5 12 4l8 3.5-8 3.5-8-3.5Z" /><path d="M4 12l8 3.5 8-3.5" /><path d="M4 16.3l8 3.5 8-3.5" /></Icon>;
export const DiskIcon = (p) => <Icon {...p}><circle cx="12" cy="12" r="8.3" /><circle cx="12" cy="12" r="2.6" /><path d="M12 3.7v3M20.3 12h-3" /></Icon>;
export const ChipIcon = (p) => <Icon {...p}><rect x="7" y="7" width="10" height="10" rx="1.5" /><path d="M9.5 7V4M14.5 7V4M9.5 20v-3M14.5 20v-3M7 9.5H4M7 14.5H4M20 9.5h-3M20 14.5h-3" /></Icon>;
export const MonitorIcon = (p) => <Icon {...p}><rect x="3.5" y="5" width="17" height="12" rx="1.5" /><path d="M9 20.5h6M12 17v3.5" /></Icon>;
export const PointerIcon = (p) => <Icon {...p}><path d="M6 3.5 18 12l-5.3 1.2L15 19l-2.5 1.2-2.3-5.6L6 17.6Z" /></Icon>;
export const PrinterIcon = (p) => <Icon {...p}><path d="M6.5 8.5V4h11v4.5" /><rect x="4" y="8.5" width="16" height="7" rx="1.5" /><rect x="7" y="14" width="10" height="6" rx="1" /></Icon>;
export const GearIcon = (p) => <Icon {...p}><circle cx="12" cy="12" r="3.3" /><path d="M12 3.8v2.3M12 17.9v2.3M20.2 12h-2.3M6.1 12H3.8M17.4 6.6l-1.6 1.6M8.2 15.8l-1.6 1.6M17.4 17.4l-1.6-1.6M8.2 8.2 6.6 6.6" /></Icon>;
export const FlaskIcon = (p) => <Icon {...p}><path d="M10 3.5h4M10.5 3.5v5.8L5.8 18.2A1.6 1.6 0 0 0 7.2 20.5h9.6a1.6 1.6 0 0 0 1.4-2.3l-4.7-8.9V3.5" /><path d="M8 15.5h8" /></Icon>;
export const CompassIcon = (p) => <Icon {...p}><circle cx="12" cy="12" r="8.3" /><path d="m14.6 9.4-2 5.2-5.2 2 2-5.2 5.2-2Z" /></Icon>;
export const PuzzleIcon = (p) => <Icon {...p}><path d="M9 4.5h4a1.5 1.5 0 0 1 0 3 1.6 1.6 0 0 0 0 3.2H16a1.5 1.5 0 0 1 0 4 1.5 1.5 0 0 0 0 3v1.8H4.5V15a1.5 1.5 0 0 1 0-3 1.5 1.5 0 0 0 0-3H4.5V4.5H9Z" /></Icon>;
export const BulbIcon = (p) => <Icon {...p}><path d="M9 18.5h6M9.7 21h4.6" /><path d="M12 3.5a6 6 0 0 0-3.4 10.9c.5.4.9 1 .9 1.6v.5h5v-.5c0-.6.4-1.2.9-1.6A6 6 0 0 0 12 3.5Z" /></Icon>;
export const BookIcon2 = (p) => <Icon {...p}><path d="M4 5.2c2.4-1 5.2-1 8 .3v13c-2.8-1.3-5.6-1.3-8-.3V5.2Z" /><path d="M20 5.2c-2.4-1-5.2-1-8 .3v13c2.8-1.3 5.6-1.3 8-.3V5.2Z" /></Icon>;

const ICON_MAP = {
  stack: StackIcon, disk: DiskIcon, chip: ChipIcon, monitor: MonitorIcon,
  pointer: PointerIcon, printer: PrinterIcon, gear: GearIcon, flask: FlaskIcon,
  compass: CompassIcon, puzzle: PuzzleIcon, bulb: BulbIcon, book: BookIcon2,
};
const ICON_KEYS = Object.keys(ICON_MAP);

const KEYWORDS = [
  [/memory|hierarch|stack|layer/i, 'stack'],
  [/disk|storage|cd-?rom|magnetic|raid/i, 'disk'],
  [/bus(es)?|circuit|hardware|chip/i, 'chip'],
  [/display|screen|crt|lcd|monitor/i, 'monitor'],
  [/mouse|mice|pointer|cursor/i, 'pointer'],
  [/printer|print(ing)?/i, 'printer'],
  [/system|process|mechanism|engine|algorithm/i, 'gear'],
  [/chemistry|lab|reaction|experiment/i, 'flask'],
  [/theory|direction|navigat|orient/i, 'compass'],
  [/idea|input|output|concept|light/i, 'bulb'],
];

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

// Keyword match first (so common CS/study terms get a genuinely related
// icon), hashed fallback across the whole set otherwise — always varied,
// never the same lone default for every unmatched topic.
export function iconKeyFor(title) {
  const t = title || '';
  for (const [re, key] of KEYWORDS) if (re.test(t)) return key;
  return ICON_KEYS[hash(t) % ICON_KEYS.length];
}

export function SubjectIcon({ title, size = 20, ...rest }) {
  const Comp = ICON_MAP[iconKeyFor(title)] || BookIcon2;
  return <Comp size={size} {...rest} />;
}

// A hand-drawn-feeling checkmark — deliberately imperfect curve, not a
// crisp geometric tick — used to mark a fully-confident checklist item.
export const WobbleCheck = ({ size = 14, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" {...rest}>
    <path d="M3.5 10.8c1.4 1.6 2.6 3 3.6 4.3 2.6-4 5.3-7.6 9-10.6" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Confidence faces — friendlier than a plain pill button. Slightly
// asymmetric mouths/eyes on purpose, matching the hand-set line quality
// of the subject icons above.
export const FaceLow = (p) => <Icon strokeWidth={1.8} {...p}><circle cx="12" cy="12" r="8.5" /><path d="M8.3 10.2h.1M15.6 10.2h.1" strokeWidth="2.4" /><path d="M8.5 16c1.2-1.4 5.8-1.4 7 0" /></Icon>;
export const FaceMid = (p) => <Icon strokeWidth={1.8} {...p}><circle cx="12" cy="12" r="8.5" /><path d="M8.3 10.4h.1M15.6 10.4h.1" strokeWidth="2.4" /><path d="M8.3 15h7.3" /></Icon>;
export const FaceHigh = (p) => <Icon strokeWidth={1.8} {...p}><circle cx="12" cy="12" r="8.5" /><path d="M8.3 10.2h.1M15.6 10.2h.1" strokeWidth="2.4" /><path d="M8 14c1.3 2 6.6 2 8 0" /></Icon>;

// Small decorative doodle for empty states — a stack of books with a
// little sparkle, in the same line language as the rest.
export const EmptyDoodle = ({ size = 72 }) => (
  <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
    <path d="M18 68V30l16-5 16 5v38l-16-5-16 5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <path d="M50 68V30l16-5 16 5v38l-16-5-16 5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" opacity=".55" />
    <path d="M76 16l1.8 4.2L82 22l-4.2 1.8L76 28l-1.8-4.2L70 22l4.2-1.8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);
