import { supabase } from '../supabase';

// Everything the Study Room needs to stop acting like a standalone
// stopwatch: the student's actual topics/checklist items (so a session
// can be *about* something), plus enough session history to make the
// AI Suggests card react to real state instead of showing static copy.
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

// Low-confidence items, most urgent (overdue for review) first, then
// oldest-rated first — these are what a "quick review round" suggestion
// should target.
export function lowConfidenceItems(context) {
  const now = Date.now();
  return context.itemRows
    .filter(i => i.confidence_rating != null && i.confidence_rating <= 2)
    .sort((a, b) => {
      const aOverdue = a.next_review_due && new Date(a.next_review_due).getTime() <= now;
      const bOverdue = b.next_review_due && new Date(b.next_review_due).getTime() <= now;
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      return new Date(a.last_reviewed_at ?? 0) - new Date(b.last_reviewed_at ?? 0);
    });
}

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'This morning';
  if (h < 18) return 'This afternoon';
  return 'Tonight';
}

// Session length by task shape, not a fixed 25 for everything — a
// nearly-finished topic (1-2 items left) is a review round, not a
// first read-through.
function suggestedMinutes(topic) {
  if (!topic) return 25;
  const remaining = topic.itemCount - topic.items.filter(i => i.confidence_rating != null).length;
  if (topic.itemCount <= 2 || remaining <= 1) return 15;
  if (topic.mastery === 0 && topic.itemCount >= 5) return 45;
  return 25;
}

// One heuristic suggestion, ranked by actual urgency — a real "act on
// this" card, not decorative copy. Returns null only when there's
// nothing in Course Planner to point at yet.
export function buildStudySuggestion(context) {
  const { topics, lastSession } = context;
  const low = lowConfidenceItems(context);

  if (low.length > 0) {
    const item = low[0];
    const topic = topics.find(t => t.id === item.topic_id);
    const overdue = item.next_review_due && new Date(item.next_review_due).getTime() <= Date.now();
    return {
      title: `${topic?.title ?? 'That topic'} needs another pass`,
      body: overdue
        ? `You marked this Low confidence and it's due for review — a focused round now beats letting it slide further.`
        : `You marked this Low confidence — want a focused review round before new material?`,
      cta: { topicId: topic?.id, itemId: item.id, minutes: 15, label: 'Start 15-min review' },
    };
  }

  if (lastSession && !lastSession.completed) {
    const topic = topics.find(t => t.id === lastSession.topic_id);
    if (topic) {
      return {
        title: `Pick up where you left off`,
        body: `Your last session on ${topic.title} ended early — want to finish that round?`,
        cta: { topicId: topic.id, itemId: lastSession.checklist_item_id, minutes: lastSession.planned_minutes, label: 'Resume' },
      };
    }
  }

  const upNext = topics.filter(t => t.mastery < 1).sort((a, b) => a.mastery - b.mastery)[0];
  if (upNext) {
    const minutes = suggestedMinutes(upNext);
    return {
      title: `${timeGreeting()}: ${upNext.title}`,
      body: `${Math.round(upNext.mastery * 100)}% through ${upNext.courseName || 'this course'} — a ${minutes}-min ${minutes <= 15 ? 'review' : 'focus'} round keeps the momentum going.`,
      cta: { topicId: upNext.id, itemId: null, minutes, label: `Start this` },
    };
  }

  if (topics.length > 0) {
    return {
      title: "You're all caught up",
      body: 'Every topic here is fully rated — nice work. A revisit never hurts, or take the win and rest.',
      cta: null,
    };
  }

  return null; // no Course Planner content yet — caller falls back to generic copy
}
