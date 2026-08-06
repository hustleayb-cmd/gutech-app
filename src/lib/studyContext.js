import { supabase } from '../supabase';

// Everything the Study Room needs to stop acting like a standalone
// stopwatch: the student's actual topics/checklist items (so a session
// can be *about* something), plus enough session history to compute
// today's focus minutes and completed-round count.
export async function loadStudyContext(userId) {
  const { data: courses } = await supabase.from('courses').select('id, name').eq('user_id', userId);
  const courseIds = (courses ?? []).map(c => c.id);

  const { data: topicRows } = courseIds.length
    ? await supabase.from('course_topics').select('*').in('course_id', courseIds).order('position')
    : { data: [] };
  const topicIds = (topicRows ?? []).map(t => t.id);

  const { data: itemRows } = topicIds.length
    ? await supabase.from('course_checklist_items').select('*').in('topic_id', topicIds).order('position')
    : { data: [] };

  const topics = (topicRows ?? []).map(t => {
    const items = (itemRows ?? []).filter(i => i.topic_id === t.id);
    const rated = items.filter(i => i.confidence_rating != null);
    const mastery = rated.length ? rated.reduce((s, i) => s + i.confidence_rating, 0) / rated.length / 5 : 0;
    const course = (courses ?? []).find(c => c.id === t.course_id);
    return { ...t, items, itemCount: items.length, mastery, courseName: course?.name ?? '' };
  });

  const { data: recentSessions } = await supabase
    .from('study_sessions').select('*').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(10);

  const lastSession = recentSessions?.[0] ?? null;
  const todayStr = new Date().toISOString().slice(0, 10);
  const sessionsToday = (recentSessions ?? []).filter(s => s.created_at?.slice(0, 10) === todayStr);

  return { topics, itemRows: itemRows ?? [], lastSession, sessionsToday };
}
