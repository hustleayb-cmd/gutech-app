import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { nextReviewDate, CONFIDENCE_LEVELS } from '../lib/spacedReview';
import { maybeNotifyReviewsDue } from '../lib/notifications';
import { accentForCourse } from '../lib/courseVisuals';
import { SubjectIcon, WobbleCheck, FaceLow, FaceMid, FaceHigh, EmptyDoodle } from './CourseIcons';
import { SparkleIcon, ChevronLeft, PlusIcon, ResetIcon, ChatBubbleIcon } from './Icons';

const FACES = { 1: FaceLow, 3: FaceMid, 5: FaceHigh };

function accentVars(accent) {
  return { '--cp-accent': accent.solid, '--cp-accent-tint': accent.tint, '--cp-accent-deep': accent.deep };
}

// Fixed 8-segment tactile track — chunkier and more "filled in" than a
// thin loading bar, and consistent regardless of how many checklist
// items a topic actually has.
function SegmentedTrack({ fraction, showPct = true }) {
  const filled = Math.round(fraction * 8);
  return (
    <div className="cp-segtrack">
      <div className="cp-segtrack-pips">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className={`cp-seg ${i < filled ? 'is-filled' : ''}`} />
        ))}
      </div>
      {showPct && <span className="cp-segtrack-pct">{Math.round(fraction * 100)}%</span>}
    </div>
  );
}

// Phase 2+3 scope: dashboard, course view (topic list, mastery fill,
// Up Next), and topic detail — checklist with confidence ratings (not
// plain done/not-done — that's the actual retention mechanic),
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
    <div className="cp-scope">
      <div className="cp-header-row">
        <div>
          <div className="cp-eyebrow">Course Planner</div>
          <h2 className="cp-page-title">Your courses</h2>
          <p className="cp-page-sub">Mapped out, topic by topic.</p>
        </div>
      </div>

      {err && <div className="cp-notice err">{err}</div>}

      {creating ? (
        <div className="cp-form-card">
          <label htmlFor="cpn">Course name</label>
          <input id="cpn" value={name} onChange={e => setName(e.target.value)} placeholder="Computer Architecture — Unit 4" />

          <label htmlFor="cpl">Google Doc / Slides / Drive link</label>
          <input id="cpl" value={sourceLink} onChange={e => setSourceLink(e.target.value)} placeholder="https://docs.google.com/... or drive.google.com/file/..." />
          <p className="cp-form-hint">Must be shared as "Anyone with the link can view".</p>

          {generating ? (
            <div className="cp-generating">
              <SparkleIcon size={15} />
              <span>Reading your material and building a topic breakdown — this can take up to a minute, especially for image-heavy PDFs.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="cp-btn-primary" onClick={createCourseAndGenerate}>
                <SparkleIcon size={15} /> Generate breakdown
              </button>
              <button className="cp-btn-ghost" onClick={() => { setCreating(false); setErr(''); }}>Cancel</button>
            </div>
          )}
        </div>
      ) : (
        <button className="cp-btn-primary" onClick={() => setCreating(true)}>
          <PlusIcon size={16} /> Add Course Material
        </button>
      )}

      {loaded && courses.length === 0 && !creating && (
        <div className="cp-empty">
          <EmptyDoodle />
          <h4>No courses yet</h4>
          <p>Add a course and paste a shared doc link to get an AI-generated topic breakdown.</p>
        </div>
      )}

      <div className="cp-course-grid">
        {courses.map(c => {
          const accent = accentForCourse(c.id);
          return (
            <div key={c.id} className="cp-course-card" style={accentVars(accent)} onClick={() => setOpenCourseId(c.id)} role="button" tabIndex={0}>
              <div className="cp-icon-badge"><SubjectIcon title={c.name} size={20} /></div>
              <div className="cp-course-card-body">
                <div className="cp-course-card-title">{c.name}</div>
                <div className="cp-course-card-meta">{c.topicCount} topic{c.topicCount === 1 ? '' : 's'}</div>
                <SegmentedTrack fraction={c.mastery} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
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
        courseId={courseId}
        userId={userId}
        onBack={() => { setOpenTopicId(null); load(); }}
      />
    );
  }

  if (!course) {
    return (
      <div className="cp-scope">
        <button className="cp-back" onClick={onBack}><ChevronLeft size={14} /> Back</button>
        {err ? <div className="cp-notice err">{err}</div> : null}
      </div>
    );
  }

  const accent = accentForCourse(courseId);
  const upNext = topics.find(t => t.mastery < 1) ?? topics[0];

  return (
    <div className="cp-scope">
      <button className="cp-back" onClick={onBack}><ChevronLeft size={14} /> All courses</button>

      {err && <div className="cp-notice err">{err}</div>}

      <div className="cp-header-row">
        <div>
          <div className="cp-eyebrow">Course</div>
          <h2 className="cp-page-title">{course.name}</h2>
        </div>
        <button className="cp-btn-ghost" onClick={regenerate} disabled={regenerating}>
          <ResetIcon size={13} /> {regenerating ? 'Working…' : 'Regenerate'}
        </button>
      </div>

      {upNext && (
        <div className="cp-hero" style={accentVars(accent)} onClick={() => setOpenTopicId(upNext.id)} role="button" tabIndex={0}>
          <div className="cp-hero-icon"><SubjectIcon title={upNext.title} size={92} /></div>
          <div className="cp-hero-eyebrow">✦ Up next</div>
          <h3 className="cp-hero-title">{upNext.title}</h3>
          <p className="cp-hero-body">{upNext.summary}</p>
          <span className="cp-hero-cta">Continue <ChevronLeft size={12} style={{ transform: 'rotate(180deg)' }} /></span>
        </div>
      )}

      <div className="cp-eyebrow">Topics — suggested order</div>
      <div className="cp-topic-list">
        {topics.map(t => (
          <div key={t.id} className="cp-topic-card" style={accentVars(accent)} onClick={() => setOpenTopicId(t.id)} role="button" tabIndex={0}>
            <div className="cp-topic-card-top">
              <div className="cp-icon-badge"><SubjectIcon title={t.title} size={18} /></div>
              <div style={{ flex: 1 }}>
                <div className="cp-topic-card-title">{t.title}</div>
              </div>
              <span className="cp-count-chip">{t.itemCount} item{t.itemCount === 1 ? '' : 's'}</span>
            </div>
            <p className="cp-topic-card-summary">{t.summary}</p>
            <SegmentedTrack fraction={t.mastery} />
          </div>
        ))}
      </div>

      <div className="cp-notice" style={{ marginTop: 14 }}>
        This is a study aid grounded in your actual material, not a substitute for reading it — AI summaries can still miss nuance.
      </div>
    </div>
  );
}

function TopicDetail({ topicId, courseId, userId, onBack }) {
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

  const accent = accentForCourse(courseId);

  if (!topic) {
    return (
      <div className="cp-scope">
        <button className="cp-back" onClick={onBack}><ChevronLeft size={14} /> Back</button>
        {err ? <div className="cp-notice err">{err}</div> : null}
      </div>
    );
  }

  return (
    <div className="cp-scope" style={accentVars(accent)}>
      <button className="cp-back" onClick={onBack}><ChevronLeft size={14} /> {topic.title}</button>

      {err && <div className="cp-notice err">{err}</div>}

      <div className="cp-eyebrow">Topic</div>
      <h2 className="cp-page-title" style={{ fontSize: 21 }}>{topic.title}</h2>
      <p className="cp-page-sub" style={{ marginBottom: 4 }}>{topic.summary}</p>

      <div className="cp-eyebrow" style={{ marginTop: 20 }}>Checklist</div>
      <div className="cp-checklist">
        {items.map(item => {
          const Face = FACES[item.confidence_rating];
          return (
            <div key={item.id} className="cp-checklist-card">
              {item.confidence_rating === 5 && <span className="cp-mastered-badge"><WobbleCheck size={16} /></span>}
              <p className="cp-checklist-item-title">{item.title}</p>

              <div className="cp-face-block">
                <div className="cp-face-label">How confident?</div>
                <div className="cp-face-row">
                  {CONFIDENCE_LEVELS.map(lvl => {
                    const LvlFace = FACES[lvl.value];
                    return (
                      <button
                        key={lvl.value}
                        className={`cp-face-btn ${item.confidence_rating === lvl.value ? 'is-active' : ''}`}
                        onClick={() => rate(item, lvl.value)}
                      >
                        <LvlFace size={22} />
                        <span>{lvl.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                className="cp-btn-ghost"
                style={{ marginTop: 12 }}
                onClick={() => setOpenChatItemId(openChatItemId === item.id ? null : item.id)}
              >
                <ChatBubbleIcon size={13} /> Explain this
              </button>

              {openChatItemId === item.id && (
                <ExplainChat topicId={topicId} itemId={item.id} />
              )}
            </div>
          );
        })}
      </div>
    </div>
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
    <div className="cp-explain">
      {err && <div className="cp-notice err">{err}</div>}
      {loaded && messages.length === 0 && (
        <p className="cp-explain-empty">Ask anything about this item — answers stay grounded in your uploaded material.</p>
      )}
      <div className="cp-explain-thread">
        {messages.map(m => (
          <div key={m.id} className={`cp-bubble ${m.role === 'user' ? 'me' : 'bot'}`}>{m.content}</div>
        ))}
      </div>
      <div className="cp-explain-input">
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ask()}
          placeholder="Ask a question…"
        />
        <button className="cp-btn-ghost" onClick={ask} disabled={busy || !question.trim()}>{busy ? '…' : 'Ask'}</button>
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
