// Per-course accent identity for the Course Planner. Six warm,
// distinct hues (not one blue + gray) so a student can recognize a
// course by its color before reading the label — deterministic by
// course id, so the same course always lands on the same hue.
export const COURSE_ACCENTS = [
  { name: 'terracotta', solid: '#C1502E', tint: '#F5E1D6', deep: '#8C3A20' },
  { name: 'teal',       solid: '#1F7A6C', tint: '#DBEEE9', deep: '#155A4F' },
  { name: 'ochre',      solid: '#BD860F', tint: '#F6E8C8', deep: '#8C6308' },
  { name: 'plum',       solid: '#7C4A8A', tint: '#EBDCEF', deep: '#5B3665' },
  { name: 'sage',       solid: '#57794C', tint: '#E1EAD9', deep: '#3E5B36' },
  { name: 'denim',      solid: '#48598C', tint: '#DFE3F1', deep: '#333F63' },
];

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

export function accentForCourse(idOrName) {
  return COURSE_ACCENTS[hash(String(idOrName)) % COURSE_ACCENTS.length];
}
