import { supabase } from '../supabase';

// Deliberately sparing: at most one notification per day, and only for
// things that are actually due (a resurfacing item ready for review).
// No daily engagement pings, no "come back!" nudges — the spec's own
// reasoning is that frequent alerts get muted wholesale, including the
// ones that matter, so a rare/high-signal approach earns more attention
// than a noisy one, not less.
const GUARD_KEY = 'gutech_review_notif_last_fired';

export async function maybeNotifyReviewsDue(userId) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem(GUARD_KEY) === today) return; // already fired once today

  const { data: prefs } = await supabase.from('notification_preferences').select('review_reminders').eq('user_id', userId).maybeSingle();
  if (prefs && prefs.review_reminders === false) return; // student turned this off

  const { count, error } = await supabase
    .from('course_checklist_items')
    .select('id, course_topics!inner(course_id, courses!inner(user_id))', { count: 'exact', head: true })
    .lte('next_review_due', new Date().toISOString())
    .eq('course_topics.courses.user_id', userId);

  if (error || !count) return;

  new Notification('Study Room', {
    body: `${count} item${count === 1 ? ' is' : 's are'} ready for review.`,
  });
  localStorage.setItem(GUARD_KEY, today);
}
