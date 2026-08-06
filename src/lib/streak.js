import { supabase } from '../supabase';

// "Never miss twice" — missing one day doesn't break the streak,
// missing two in a row does. Framed neutrally on purpose: a broken
// streak never shows as a loud red "you failed" moment, just a reset
// counter. Deliberately not a stricter zero-miss streak — those exploit
// loss aversion and tend to make people abandon the habit entirely once
// they finally do break, which defeats the point.
//
// "Active" here means "opened the app" — simplest signal that works
// app-wide without wiring a check-in call into every feature
// individually. Good enough for a motivating streak; not a precise
// study-time tracker.
//
// Returns null (not a fake 0/1) if the write couldn't be confirmed —
// callers should show "—" rather than a number we don't actually know
// is correct.
export async function checkInStreak(userId) {
  const today = new Date().toISOString().slice(0, 10);

  const { data: row, error: selErr } = await supabase.from('user_streaks').select('*').eq('user_id', userId).maybeSingle();
  if (selErr) { console.error('checkInStreak select failed:', selErr.message); return { current_streak: null, justBroken: false }; }

  if (!row) {
    const { error: insErr } = await supabase.from('user_streaks').insert({ user_id: userId, current_streak: 1, last_active_date: today });
    if (insErr) { console.error('checkInStreak insert failed:', insErr.message); return { current_streak: null, justBroken: false }; }
    return { current_streak: 1, justBroken: false };
  }

  if (row.last_active_date === today) return { current_streak: row.current_streak, justBroken: false };

  const daysSince = Math.round((new Date(today) - new Date(row.last_active_date)) / 86400000);
  const daysMissed = daysSince - 1; // 1 = came back the next day, 0 missed days

  const nextStreak = daysMissed <= 1 ? row.current_streak + 1 : 1;
  const justBroken = daysMissed > 1;

  const { error: updErr } = await supabase.from('user_streaks').update({ current_streak: nextStreak, last_active_date: today }).eq('user_id', userId);
  if (updErr) { console.error('checkInStreak update failed:', updErr.message); return { current_streak: row.current_streak, justBroken: false }; }
  return { current_streak: nextStreak, justBroken };
}
