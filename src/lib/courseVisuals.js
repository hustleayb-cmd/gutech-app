// Per-course accent identity for the Course Planner — six shades within
// GUtech's own blue family (matching MEMBER_COLORS in roomColors.js),
// not an unrelated warm palette, so a student can still tell courses
// apart by color without the app looking like it's wearing two
// different brands. Deterministic by course id.
export const COURSE_ACCENTS = [
  { name: 'gu-blue',    solid: '#0057A8', tint: '#DCE9F7', deep: '#003E7A' },
  { name: 'deep-blue',  solid: '#003E7A', tint: '#D7E1EE', deep: '#00294F' },
  { name: 'mid-blue',   solid: '#5D82B8', tint: '#E3EAF5', deep: '#3E5D8A' },
  { name: 'rwth-blue',  solid: '#6D93CE', tint: '#E7EEF9', deep: '#4A6BA0' },
  { name: 'blue-grey',  solid: '#4A6485', tint: '#E1E7ED', deep: '#33455E' },
  { name: 'slate-blue', solid: '#3B5578', tint: '#DEE4EC', deep: '#253A54' },
];

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

export function accentForCourse(idOrName) {
  return COURSE_ACCENTS[hash(String(idOrName)) % COURSE_ACCENTS.length];
}
