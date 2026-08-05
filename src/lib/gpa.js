// Shared between Grades.jsx and Home.jsx so the GPA math only lives once.
export const GRADE_POINTS = {
  'A': 4.0, 'A-': 3.7,
  'B+': 3.3, 'B': 3.0, 'B-': 2.7,
  'C+': 2.3, 'C': 2.0, 'C-': 1.7,
  'D+': 1.3, 'D': 1.0,
  'F': 0.0,
};

export const GRADE_OPTIONS = Object.keys(GRADE_POINTS);

export function computeGPA(rows) {
  let points = 0;
  let hours = 0;
  for (const r of rows) {
    const p = GRADE_POINTS[r.grade];
    const h = Number(r.credit_hours) || 0;
    if (p === undefined || h <= 0) continue;
    points += p * h;
    hours += h;
  }
  return { gpa: hours > 0 ? points / hours : 0, hours };
}
