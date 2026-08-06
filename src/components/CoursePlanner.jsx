import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { nextReviewDate, CONFIDENCE_LEVELS } from '../lib/spacedReview';
import { maybeNotifyReviewsDue } from '../lib/notifications';
import { SparkleIcon, BookIcon, PinIcon, ChevronLeft, PlusIcon, ResetIcon, CheckIcon, ChatBubbleIcon } from './Icons';

// Phase 2+3 scope: dashboard, course view (topic list, mastery fill,
// Up Next), and now topic detail — checklist with confidence ratings
// (not plain done/not-done — that's the actual retention mechanic),
// confidence-driven resurfacing, and the "Explain this" inline chat.
export default function CoursePlanner({ userId }) {
  const [courses, setCourses] = useState([]);
  const [openCourseId, setOpenCourseId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [sourceLink, setSourceLink] = useState('');
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { loadCourses(); maybeNotifyReviewsDue(userId); }, []);

  async function loadCourses() {
    const { data: courseRows, error: cErr } = await supabase
      .from('courses').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (cErr) { setErr(cErr.message); setLoaded(true); return; }

    const ids = (courseRows ?? []).map(c => c.id);
    const { data: topicRows } = ids.length
      ? await supabase.from('course_topics').select('id, course_id').in('course_id', ids)
      : { data: [] };
    const topicIds = (topicRows ?? []).map(t => t.id);
    const { data: itemRows } = topicIds.length
      ? await supabase.from('course_checklist_items').select('topic_id, confidence_rating').in('topic_id', topicIds)
      : { data: [] };

    const withStats = (courseRows ?? []).map(c => {
      const myTopicIds = (topicRows ?? []).filter(t => t.course_id === c.id).map(t => t.id);
      const myItems = (itemRows ?? []).filter(i => myTopicIds.includes(i.topic_id));
      return { ...c, topicCount: myTopicIds.length, mastery: masteryFraction(myItems) };
    });
    setCourses(withStats);
    setLoaded(true);
  }

  async function createCourseAndGenerate() {
    if (!name.trim()) { setErr('Give the course a name.'); return; }
    if (!sourceLink.trim()) { setErr('Paste a Google Doc, Slides, or Drive file link.'); return; }
    setErr('');

    const { data: course, error: insErr } = await supabase
      .from('courses').insert({ user_id: userId, name: name.trim() }).select().single();
    if (insErr) { setErr(insErr.message); return; }

    setGenerating(true);
    const { data, error } = await supabase.functions.invoke('course-planner', {
      body: { action: 'generate', courseId: course.id, sourceLink: sourceLink.trim() },
    });
    setGenerating(false);

    if (error || data?.error) {
      setErr(data?.error || error.message || 'Something went wrong generating the topic breakdown.');
      return;
    }

    setName(''); setSourceLink(''); setCreating(false);
    await loadCourses();
    setOpenCourseId(course.id);
  }

  if (openCourseId) {
    return <CourseView courseId={openCourseId} userId={userId} onBack={() => { setOpenCourseId(null); loadCourses(); }} />;
  }

  return (
    <>
      <div className="annot">Course Planner</div>

      {err && <div className="notice err">{err}</div>}

      {creating ? (
        <div className="card">
          <label htmlFor="cpn">Course name</label>
          <input id="cpn" value={name} onChange={e => setName(e.target.value)} placeholder="Computer Architecture — Unit 4" />

          <label htmlFor="cpl">Google Doc / Slides / Drive link</label>
          <input id="cpl" value={sourceLink} onChange={e => setSourceLink(e.target.value)} placeholder="https://docs.google.com/... or drive.google.com/file/..." />
          <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: -8, marginBottom: 14 }}>
            Must be shared as "Anyone with the link can view".
          </p>

          {generating ? (
            <div className="notice" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <SparkleIcon size={15} />
              <span>Reading your material and building a topic breakdown — this can take up to a minute, especially for image-heavy PDFs.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="primary" onClick={createCourseAndGenerate}>
                <SparkleIcon size={15} /> Generate breakdown
              </button>
              <button className="ghost" onClick={() => { setCreating(false); setErr(''); }}>Cancel</button>
            </div>
          )}
        </div>
      ) : (
        <button className="primary" onClick={() => setCreating(true)}>
          <PlusIcon size={16} /> Add Course Material
        </button>
      )}

      {loaded && courses.length === 0 && !creating && (
        <div className="empty" style={{ marginTop: 14 }}>
          <div className="k"><BookIcon size={14} /> No courses yet</div>
          <p>Add a course and paste a shared doc link to get an AI-generated topic breakdown.</p>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        {courses.map(c => (
          <div key={c.id} className="card course-card" onClick={() => setOpenCourseId(c.id)} role="button" tabIndex={0}>
            <div className="row">
              <h3 style={{ fontSize: 16 }}>{c.name}</h3>
              <span className="stamp badge-neutral">{c.topicCount} topic{c.topicCount === 1 ? '' : 's'}</span>
            </div>
            <div className="mastery-row">
              <div className="room-progress-track">
                <div className="room-progress-fill" style={{ width: `${Math.round(c.mastery * 100)}%` }} />
              </div>
              <span className="mastery-pct">{Math.round(c.mastery * 100)}%</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function CourseView({ courseId, userId, onBack }) {
  const [course, setCourse] = useState(null);
  const [topics, setTopics] = useState([]);
  const [openTopicId, setOpenTopicId] = useState(null);
  const [regenerating, setRegenerating] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { load(); }, [courseId]);

  async function load() {
    const [{ data: courseRow, error: cErr }, { data: topicRows, error: tErr }] = await Promise.all([
      supabase.from('courses').select('*').eq('id', courseId).maybeSingle(),
      supabase.from('course_topics').select('*').eq('course_id', courseId).order('position'),
    ]);
    if (cErr) { setErr(cErr.message); return; }
    if (tErr) { setErr(tErr.message); return; }

    const topicIds = (topicRows ?? []).map(t => t.id);
    const { data: itemRows } = topicIds.length
      ? await supabase.from('course_checklist_items').select('topic_id, confidence_rating').in('topic_id', topicIds)
      : { data: [] };

    const withMastery = (topicRows ?? []).map(t => ({
      ...t,
      mastery: masteryFraction((itemRows ?? []).filter(i => i.topic_id === t.id)),
      itemCount: (itemRows ?? []).filter(i => i.topic_id === t.id).length,
    }));
    setCourse(courseRow);
    setTopics(withMastery);
  }

  async function regenerate() {
    const { data: material } = await supabase
      .from('course_materials').select('source_link').eq('course_id', courseId)
      .order('last_synced_at', { ascending: false }).limit(1).maybeSingle();
    if (!material?.source_link) { setErr('No source link on file for this course.'); return; }

    setRegenerating(true); setErr('');
    const { data, error } = await supabase.functions.invoke('course-planner', {
      body: { action: 'generate', courseId, sourceLink: material.source_link },
    });
    setRegenerating(false);
    if (error || data?.error) { setErr(data?.error || error.message); return; }
    await load();
  }

  if (openTopicId) {
    return (
      <TopicDetail
        topicId={openTopicId}
        userId={userId}
        onBack={() => { setOpenTopicId(null); load(); }}
      />
    );
  }

  if (!course) {
    return (
      <>
        <button className="ghost" onClick={onBack}><ChevronLeft size={14} /> Back</button>
        {err ? <div className="notice err" style={{ marginTop: 14 }}>{err}</div> : null}
      </>
    );
  }

  // Up Next: first topic, in suggested order, that isn't fully rated
  // high-confidence yet.
  const upNext = topics.find(t => t.mastery < 1) ?? topics[0];

  return (
    <>
      <button className="ghost" onClick={onBack} style={{ marginBottom: 14 }}>
        <ChevronLeft size={14} /> All courses
      </button>

      {err && <div className="notice err">{err}</div>}

      <div className="row" style={{ alignItems: 'flex-start' }}>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>{course.name}</h2>
        <button className="ghost" onClick={regenerate} disabled={regenerating}>
          <ResetIcon size={13} /> {regenerating ? 'Working…' : 'Regenerate'}
        </button>
      </div>

      {upNext && (
        <div className="card up-next-card" onClick={() => setOpenTopicId(upNext.id)} role="button" tabIndex={0}>
          <div className="row" style={{ gap: 8, justifyContent: 'flex-start', marginBottom: 6 }}>
            <PinIcon size={14} className="pin-icon" />
            <span className="up-next-label">Up next</span>
          </div>
          <h3 style={{ fontSize: 15 }}>{upNext.title}</h3>
          <p style={{ marginTop: 4 }}>{upNext.summary}</p>
        </div>
      )}

      <div className="annot">Topics — suggested order</div>
      {topics.map(t => (
        <div key={t.id} className="card topic-row" onClick={() => setOpenTopicId(t.id)} role="button" tabIndex={0}>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <h3 style={{ fontSize: 15 }}>{t.title}</h3>
            <span className="stamp badge-neutral">{t.itemCount} item{t.itemCount === 1 ? '' : 's'}</span>
          </div>
          <p>{t.summary}</p>
          <div className="mastery-row" style={{ marginTop: 10 }}>
            <div className="room-progress-track">
              <div className="room-progress-fill" style={{ width: `${Math.round(t.mastery * 100)}%` }} />
            </div>
            <span className="mastery-pct">{Math.round(t.mastery * 100)}%</span>
          </div>
        </div>
      ))}

      <div className="notice" style={{ marginTop: 4 }}>
        This is a study aid grounded in your actual material, not a substitute for reading it — AI summaries can still miss nuance.
      </div>
    </>
  );
}

function TopicDetail({ topicId, userId, onBack }) {
  const [topic, setTopic] = useState(null);
  const [items, setItems] = useState([]);
  const [openChatItemId, setOpenChatItemId] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => { load(); }, [topicId]);

  async function load() {
    const [{ data: topicRow, error: tErr }, { data: itemRows, error: iErr }] = await Promise.all([
      supabase.from('course_topics').select('*').eq('id', topicId).maybeSingle(),
      supabase.from('course_checklist_items').select('*').eq('topic_id', topicId).order('position'),
    ]);
    if (tErr) { setErr(tErr.message); return; }
    if (iErr) { setErr(iErr.message); return; }
    setTopic(topicRow);
    setItems(itemRows ?? []);
  }

  // The actual retention mechanic: rating confidence (not a plain
  // checkbox) sets when this item gets resurfaced next — lower
  // confidence brings it back sooner.
  async function rate(item, value) {
    const { error } = await supabase.from('course_checklist_items').update({
      confidence_rating: value,
      last_reviewed_at: new Date().toISOString(),
      next_review_due: nextReviewDate(value),
    }).eq('id', item.id);
    if (error) { setErr(error.message); return; }
    setItems(prev => prev.map(i => (i.id === item.id ? { ...i, confidence_rating: value } : i)));
  }

  if (!topic) {
    return (
      <>
        <button className="ghost" onClick={onBack}><ChevronLeft size={14} /> Back</button>
        {err ? <div className="notice err" style={{ marginTop: 14 }}>{err}</div> : null}
      </>
    );
  }

  return (
    <>
      <button className="ghost" onClick={onBack} style={{ marginBottom: 14 }}>
        <ChevronLeft size={14} /> {topic.title}
      </button>

      {err && <div className="notice err">{err}</div>}

      <h2 style={{ fontSize: 19, fontWeight: 800 }}>{topic.title}</h2>
      <p style={{ marginTop: 6, color: 'var(--text-muted)', fontSize: 14 }}>{topic.summary}</p>

      <div className="annot">Checklist</div>
      {items.map(item => (
        <div key={item.id} className="card checklist-item-card">
          <p style={{ marginTop: 0, fontSize: 14, color: 'var(--text-main)' }}>{item.title}</p>

          <div className="row" style={{ marginTop: 12 }}>
            <div className="confidence-row">
              <span className="confidence-label">How confident?</span>
              <div className="confidence-btns">
                {CONFIDENCE_LEVELS.map(lvl => (
                  <button
                    key={lvl.value}
                    className={`confidence-btn ${item.confidence_rating === lvl.value ? 'is-active' : ''}`}
                    style={{ opacity: 0.3 + (lvl.value / 5) * 0.7 }}
                    onClick={() => rate(item, lvl.value)}
                  >
                    {item.confidence_rating === lvl.value && <CheckIcon size={11} />} {lvl.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            className="ghost"
            style={{ marginTop: 10 }}
            onClick={() => setOpenChatItemId(openChatItemId === item.id ? null : item.id)}
          >
            <ChatBubbleIcon size={13} /> Explain this
          </button>

          {openChatItemId === item.id && (
            <ExplainChat topicId={topicId} itemId={item.id} />
          )}
        </div>
      ))}
    </>
  );
}

function ExplainChat({ topicId, itemId }) {
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.from('course_chat_messages').select('*').eq('topic_id', topicId).eq('checklist_item_id', itemId)
      .order('created_at').then(({ data, error }) => {
        if (error) setErr(error.message);
        setMessages(data ?? []);
        setLoaded(true);
      });
  }, [topicId, itemId]);

  async function ask() {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true); setErr('');
    setMessages(prev => [...prev, { role: 'user', content: q, id: `local-${Date.now()}` }]);
    setQuestion('');

    const { data, error } = await supabase.functions.invoke('course-planner', {
      body: { action: 'explain', topicId, itemId, question: q },
    });
    setBusy(false);

    if (error || data?.error) { setErr(data?.error || error.message); return; }
    setMessages(prev => [...prev, { role: 'assistant', content: data.answer, id: `local-a-${Date.now()}` }]);
  }

  return (
    <div className="explain-chat">
      {err && <div className="notice err">{err}</div>}
      {loaded && messages.length === 0 && (
        <p className="explain-chat-empty">Ask anything about this item — answers stay grounded in your uploaded material.</p>
      )}
      <div className="explain-chat-thread">
        {messages.map(m => (
          <div key={m.id} className={`explain-bubble ${m.role === 'user' ? 'me' : 'bot'}`}>{m.content}</div>
        ))}
      </div>
      <div className="explain-chat-input">
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ask()}
          placeholder="Ask a question…"
          style={{ margin: 0 }}
        />
        <button className="ghost" onClick={ask} disabled={busy || !question.trim()}>{busy ? '…' : 'Ask'}</button>
      </div>
    </div>
  );
}

// Average confidence_rating (0-5) across rated items, scaled to 0-1.
// Unrated items don't count against or for mastery — they just haven't
// been reviewed yet, which is different from "confirmed low confidence".
function masteryFraction(items) {
  const rated = items.filter(i => i.confidence_rating != null);
  if (rated.length === 0) return 0;
  const avg = rated.reduce((sum, i) => sum + i.confidence_rating, 0) / rated.length;
  return avg / 5;
}
