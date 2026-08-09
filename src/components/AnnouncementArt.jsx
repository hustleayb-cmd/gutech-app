// Procedural hero art for announcement cards — no external images, no API
// calls, nothing that can fail or cost money. Each category gets its own
// abstract scene (color wash + blurred orbs + a large line-icon motif, in
// the same 1.75-stroke language as the rest of the app's icon set), and a
// per-announcement seed derived from its title/id jitters the orb
// positions, rotation and accent shape so two "Event" posts don't render
// as literally the same picture — the closest honest approximation of
// "generated per announcement" without an actual image model available.

// Small deterministic hash — same string always produces the same seed, so
// a given announcement's art doesn't shuffle on every re-render.
function seedFrom(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

// Pulls a small deterministic number out of one seed, in [0, mod) — cheap
// stand-in for a seeded RNG.
function pick(seed, salt, mod) {
  return ((seed ^ (salt * 2654435761)) >>> 0) % mod;
}

const THEME = {
  general: { var: '--cat-general', glow: 'rgba(0, 87, 168, 0.16)' },
  academic: { var: '--cat-academic', glow: 'rgba(107, 92, 214, 0.16)' },
  event: { var: '--cat-event', glow: 'rgba(31, 157, 107, 0.16)' },
  deadline: { var: '--cat-deadline', glow: 'rgba(201, 134, 11, 0.16)' },
};

// One large centered motif per category, drawn in the app's existing
// stroke style (round caps/joins, scaled up).
function Motif({ category }) {
  const stroke = { fill: 'none', stroke: `var(${THEME[category]?.var || '--cat-general'})`, strokeWidth: 3.2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (category) {
    case 'deadline':
      // Clock face with hands pointing to "almost time" — reads as
      // urgency without a literal countdown or invoice cliché.
      return (
        <g transform="translate(160,80)">
          <circle cx="0" cy="0" r="34" {...stroke} />
          <path d="M0 -34 L0 -40 M0 34 L0 40 M-34 0 L-40 0 M34 0 L40 0" {...stroke} />
          <path d="M0 0 L0 -20 M0 0 L14 8" {...stroke} />
        </g>
      );
    case 'event':
      // Three figures — a small crowd, evoking a fair/networking floor.
      return (
        <g transform="translate(160,80)" {...stroke}>
          <circle cx="-28" cy="-16" r="9" />
          <path d="M-42 22c0-12 8-20 14-20s14 8 14 20" />
          <circle cx="0" cy="-20" r="10" />
          <path d="M-15 24c0-14 9-22 15-22s15 8 15 22" />
          <circle cx="30" cy="-16" r="9" />
          <path d="M16 22c0-12 8-20 14-20s14 8 14 20" />
        </g>
      );
    case 'academic':
      // Open book, doubling as "graduation" via the small pennant above.
      return (
        <g transform="translate(160,80)" {...stroke}>
          <path d="M-32 -6c10-6 20-8 32-4 12-4 22-2 32 4v34c-10-6-20-8-32-4-12-4-22-2-32 4Z" />
          <path d="M0 -10v34" />
          <path d="M0 -34l-16 8 16 8 16-8Z" />
        </g>
      );
    default:
      // "general" / welcome — a speech bubble, echoing the app's own
      // Ask-tab icon: a friendly "new here, here's the tour" feel.
      return (
        <g transform="translate(160,80)" {...stroke}>
          <path d="M-34 -20a10 10 0 0 1 10-10h48a10 10 0 0 1 10 10v22a10 10 0 0 1-10 10H-6l-14 13v-13h-4a10 10 0 0 1-10-10Z" />
          <path d="M-14 -12h30M-14 0h20" strokeWidth="2.6" />
        </g>
      );
  }
}

export default function AnnouncementArt({ category = 'general', seedKey = '' }) {
  const theme = THEME[category] || THEME.general;
  const seed = seedFrom(`${category}:${seedKey}`);

  // Three soft blurred orbs, jittered per-announcement within a range that
  // keeps them clear of the centered motif.
  const orbs = [0, 1, 2].map(i => ({
    cx: 40 + pick(seed, i * 3 + 1, 260),
    cy: 20 + pick(seed, i * 3 + 2, 120),
    r: 26 + pick(seed, i * 3 + 3, 30),
  }));

  const rotate = pick(seed, 99, 8) - 4; // -4..3deg — keeps the scene feeling non-static without being noisy

  return (
    <svg
      className="announcement-art"
      viewBox="0 0 320 160"
      preserveAspectRatio="xMidYMid slice"
      role="presentation"
      aria-hidden="true"
    >
      <rect width="320" height="160" fill="var(--bg-surface-alt)" />
      {orbs.map((o, i) => (
        <circle key={i} cx={o.cx} cy={o.cy} r={o.r} fill={theme.glow} />
      ))}
      <g style={{ transform: `rotate(${rotate}deg)`, transformOrigin: '160px 80px' }} opacity="0.9">
        <Motif category={category} />
      </g>
    </svg>
  );
}
