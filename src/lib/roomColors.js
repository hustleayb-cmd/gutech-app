// Member avatar colors — a fixed small palette of GUtech-blue tints/
// shades plus neutral grey, so a room with several people still reads
// as one cohesive brand instead of a random rainbow. `color_index` is
// stored per membership row and picked deterministically at join time.
export const MEMBER_COLORS = [
  '#0055A9', // GUtech blue
  '#85A5D5', // RWTH light blue
  '#003E7A', // deep blue
  '#5D82B8', // mid blue
  '#8A8A8A', // neutral grey
  '#2C6FB0', // blue-grey
];

export function colorForIndex(index) {
  return MEMBER_COLORS[index % MEMBER_COLORS.length];
}

export function initials(nameOrEmail) {
  const base = (nameOrEmail || '?').split('@')[0];
  return base.trim().split(/[\s._-]+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}
