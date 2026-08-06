// Confidence-driven resurfacing — not a fixed calendar. Lower
// confidence brings an item back sooner; higher confidence pushes it
// further out. This is a simple heuristic, not full SM-2 spaced
// repetition, but it satisfies the actual requirement: review timing
// driven by how sure the student says they are, not elapsed time alone.
const INTERVAL_DAYS = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 14 };

export function nextReviewDate(confidenceRating) {
  const days = INTERVAL_DAYS[confidenceRating] ?? 3;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export const CONFIDENCE_LEVELS = [
  { value: 1, label: 'Low' },
  { value: 3, label: 'Medium' },
  { value: 5, label: 'High' },
];
