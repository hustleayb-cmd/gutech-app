import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase';
import CoursePlanner from './CoursePlanner';
import { loadStudyContext, buildStudySuggestion } from '../lib/studyContext';
import { nextReviewDate, CONFIDENCE_LEVELS } from '../lib/spacedReview';
import { accentForCourse } from '../lib/courseVisuals';
import { SubjectIcon, FaceLow, FaceMid, FaceHigh, WobbleCheck } from './CourseIcons';
import { PlayIcon, PauseIcon, StopIcon, ResetIcon, ChartIcon, CloseIcon, SparkleIcon, TimerIcon, SparkleIcon as PlannerIcon, ChevronLeft } from './Icons';

// A timer that's tied to real Course Planner work, not a standalone
// stopwatch — "25:00" is supposed to mean "25 minutes on Memory
// Hierarchies," not just 25 minutes. See src/lib/studyContext.js for
// the suggestion heuristics and schema.sql's study_sessions table for
// how a session round-trips back into a checklist item's confidence
// rating and resurfacing schedule.
//
// Course Planner lives here as a section, not a separate top-level tab —
// both are "get down to studying" surfaces, so they share a home instead
// of splintering across the nav.

const MODES = {
  pomodoro: { label: 'Pomodoro', defaultMinutes: 25 },
  short: { label: 'Short Break', defaultMinutes: 5 },
  long: { label: 'Long Break', defaultMinutes: 15 },
};

const MIN_MINUTES = 5;
const MAX_MINUTES = 60;
const DAILY_GOAL_MINUTES = 100; // fixed for now — not user-configurable yet
const FACES = { 1: FaceLow, 3: FaceMid, 5: FaceHigh };

export default function StudyRoom({ userId }) {
  const [section, setSection] = useState('timer'); // 'timer' | 'courses'
  const [durations, setDurations] = useState({ pomodoro: 25, short: 5, long: 15 });
  const [mode, setMode] = useState('pomodoro');
  const [status, setStatus] = useState('idle'); // idle | running | paused
  const [msLeft, setMsLeft] = useState(durations.pomodoro * 60 * 1000);
  const [roundGoal, setRoundGoal] = useState(4);
  const [roundsCompleted, setRoundsCompleted] = useState(0);
  const [editingGoal, setEditingGoal] = useState(false);
  const [suggestion, setSuggestion] = useState(null); // break-prompt banner, { nextMode } | null
  const [statsNotice, setStatsNotice] = useState(false);

  const [context, setContext] = useState({ topics: [], itemRows: [], lastSession: null, sessionsToday: [] });
  const [sessionTopic, setSessionTopic] = useState(null); // { topic, item } | null
  const [pickerOpen, setPickerOpen] = useState(false);
  const [recap, setRecap] = useState(null); // shown after a pomodoro session naturally completes
  const [showDots, setShowDots] = useState(false);

  const endTimeRef = useRef(null);
  const sessionIdRef = useRef(null);
  const hiddenAtRef = useRef(null);
  const distractionRef = useRef({ count: 0, seconds: 0 });

  useEffect(() => { refreshContext(); }, [userId]);

  async function refreshContext() {
    const ctx = await loadStudyContext(userId);
    setContext(ctx);
  }

  // Keep the displayed time in sync with whatever mode/duration is
  // selected while idle.
  useEffect(() => {
    if (status === 'idle') setMsLeft(durations[mode] * 60 * 1000);
  }, [mode, durations, status]);

  useEffect(() => {
    if (status !== 'running') return;
    const id = setInterval(() => {
      const left = Math.max(0, endTimeRef.current - Date.now());
      setMsLeft(left);
      if (left <= 0) {
        clearInterval(id);
        handleSessionComplete();
      }
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Lightweight distraction log — no shaming, just an honest tally
  // shown once, gently, in the end-of-session recap.
  useEffect(() => {
    function onVisibility() {
      if (status !== 'running') return;
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
      } else if (hiddenAtRef.current) {
        const away = (Date.now() - hiddenAtRef.current) / 1000;
        distractionRef.current = { count: distractionRef.current.count + 1, seconds: distractionRef.current.seconds + away };
        hiddenAtRef.current = null;
      }
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [status]);

  async function handleSessionComplete() {
    setStatus('idle');
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Study Room', {
        body: mode === 'pomodoro' ? 'Pomodoro complete — nice work.' : 'Break\'s over.',
      });
    }

    const plannedSeconds = durations[mode] * 60;
    if (sessionIdRef.current) {
      await supabase.from('study_sessions').update({
        actual_seconds: plannedSeconds, completed: true,
        distraction_count: distractionRef.current.count, distraction_seconds: Math.round(distractionRef.current.seconds),
      }).eq('id', sessionIdRef.current);
    }

    if (mode === 'pomodoro') {
      const nextCount = roundsCompleted + 1;
      setRoundsCompleted(nextCount);
      // Recap replaces the plain break-prompt for focus rounds — there's
      // something worth capturing (what was studied, how confident they
      // feel now); breaks don't need that.
      setRecap({
        topic: sessionTopic?.topic ?? null,
        item: sessionTopic?.item ?? null,
        minutes: durations.pomodoro,
        distraction: { ...distractionRef.current },
        isLongDue: nextCount % roundGoal === 0,
      });
    } else {
      if (mode === 'long') setRoundsCompleted(0);
      setSuggestion({ nextMode: 'pomodoro' });
    }
    sessionIdRef.current = null;
  }

  async function start() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    distractionRef.current = { count: 0, seconds: 0 };
    hiddenAtRef.current = null;

    const { data } = await supabase.from('study_sessions').insert({
      user_id: userId,
      topic_id: sessionTopic?.topic?.id ?? null,
      checklist_item_id: sessionTopic?.item?.id ?? null,
      mode, planned_minutes: durations[mode],
    }).select().single();
    sessionIdRef.current = data?.id ?? null;

    endTimeRef.current = Date.now() + msLeft;
    setStatus('running');
    setSuggestion(null);
  }

  function pause() { setStatus('paused'); }
  function resume() { endTimeRef.current = Date.now() + msLeft; setStatus('running'); }

  async function stop() {
    if (sessionIdRef.current) {
      const actual = Math.round((durations[mode] * 60 * 1000 - msLeft) / 1000);
      await supabase.from('study_sessions').update({
        actual_seconds: Math.max(0, actual), completed: false,
        distraction_count: distractionRef.current.count, distraction_seconds: Math.round(distractionRef.current.seconds),
      }).eq('id', sessionIdRef.current);
      sessionIdRef.current = null;
    }
    setStatus('idle');
    setMsLeft(durations[mode] * 60 * 1000);
    setSuggestion(null);
  }

  function reset() {
    setMsLeft(durations[mode] * 60 * 1000);
    if (status === 'running') endTimeRef.current = Date.now() + durations[mode] * 60 * 1000;
  }

  function switchMode(next) {
    setMode(next);
    setStatus('idle');
    setSuggestion(null);
  }

  function adjustDuration(delta) {
    if (status !== 'idle') return;
    setDurations(prev => ({ ...prev, [mode]: Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, prev[mode] + delta)) }));
  }

  function acceptSuggestion() { switchMode(suggestion.nextMode); }

  function pickTopic(topic, item) {
    setSessionTopic({ topic, item: item ?? null });
    setPickerOpen(false);
  }

  function applyAiSuggestion(cta) {
    const topic = context.topics.find(t => t.id === cta.topicId);
    const item = cta.itemId ? context.itemRows.find(i => i.id === cta.itemId) : null;
    setSessionTopic(topic ? { topic, item } : null);
    setMode('pomodoro');
    setDurations(prev => ({ ...prev, pomodoro: cta.minutes }));
    // start() reads sessionTopic/durations from state, which won't have
    // committed yet this tick — defer one frame so it picks up both.
    setTimeout(() => start(), 0);
  }

  async function closeRecap({ finished, confidence, note }) {
    if (recap?.item && confidence) {
      await supabase.from('course_checklist_items').update({
        confidence_rating: confidence, last_reviewed_at: new Date().toISOString(), next_review_due: nextReviewDate(confidence),
      }).eq('id', recap.item.id);
    }
    // Best-effort: update the most recent session row for this user with the recap answers.
    const { data: latest } = await supabase.from('study_sessions').select('id').eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (latest?.id) {
      await supabase.from('study_sessions').update({ finished_task: finished ?? null, confidence_after: confidence ?? null, note: note ?? null }).eq('id', latest.id);
    }

    const isLongDue = recap?.isLongDue;
    setRecap(null);
    setSessionTopic(finished ? null : sessionTopic); // keep the topic loaded if they didn't finish, so "Continue" is one tap
    setSuggestion({ nextMode: isLongDue ? 'long' : 'short' });
    refreshContext();
  }

  const totalMs = durations[mode] * 60 * 1000;
  const progress = totalMs > 0 ? 1 - msLeft / totalMs : 0;
  const radius = 92;
  const circumference = 2 * Math.PI * radius;
  const outerRadius = 102;
  const outerCircumference = 2 * Math.PI * outerRadius;

  const mm = String(Math.floor(msLeft / 60000)).padStart(2, '0');
  const ss = String(Math.floor((msLeft % 60000) / 1000)).padStart(2, '0');

  const statusLabel = status === 'running' ? 'Focusing' : status === 'paused' ? 'Paused' : 'Ready';
  const durationFill = ((durations[mode] - MIN_MINUTES) / (MAX_MINUTES - MIN_MINUTES)) * 100;

  const todaySeconds = context.sessionsToday.reduce((s, r) => s + (r.actual_seconds || 0), 0);
  const todayMinutes = Math.round(todaySeconds / 60);
  const dailyProgress = Math.min(1, todayMinutes / DAILY_GOAL_MINUTES);
  const completedToday = context.sessionsToday.filter(s => s.mode === 'pomodoro' && s.completed);

  const aiSuggestion = suggestion || recap ? null : buildStudySuggestion(context);

  return (
    <>
      <div className="chip-row study-segmented" style={{ marginBottom: 14 }}>
        <button className={`chip ${section === 'timer' ? 'chip-on' : ''}`} onClick={() => setSection('timer')}>
          <TimerIcon size={13} /> Focus Timer
        </button>
        <button className={`chip ${section === 'courses' ? 'chip-on' : ''}`} onClick={() => setSection('courses')}>
          <PlannerIcon size={13} /> Course Planner
        </button>
      </div>

      {section === 'courses' ? <CoursePlanner userId={userId} /> : (
        <>
          <TimerSection
            statsNotice={statsNotice} setStatsNotice={setStatsNotice}
            suggestion={suggestion} acceptSuggestion={acceptSuggestion} setSuggestion={setSuggestion}
            status={status} statusLabel={statusLabel} roundsCompleted={roundsCompleted} roundGoal={roundGoal}
            radius={radius} circumference={circumference} progress={progress} mm={mm} ss={ss} mode={mode} MODES={MODES}
            durations={durations} durationFill={durationFill} adjustDuration={adjustDuration}
            editingGoal={editingGoal} setEditingGoal={setEditingGoal} setRoundGoal={setRoundGoal}
            switchMode={switchMode} stop={stop} pause={pause} resume={resume} start={start} reset={reset}
            aiSuggestion={aiSuggestion} applyAiSuggestion={applyAiSuggestion}
            sessionTopic={sessionTopic} setSessionTopic={setSessionTopic} setPickerOpen={setPickerOpen}
            outerRadius={outerRadius} outerCircumference={outerCircumference} dailyProgress={dailyProgress} todayMinutes={todayMinutes}
            completedToday={completedToday} showDots={showDots} setShowDots={setShowDots}
          />
          {pickerOpen && (
            <TopicPicker
              topics={context.topics}
              onPick={pickTopic}
              onClose={() => setPickerOpen(false)}
            />
          )}
          {recap && (
            <SessionRecap recap={recap} onClose={closeRecap} />
          )}
        </>
      )}
    </>
  );
}

function TimerSection({
  statsNotice, setStatsNotice, suggestion, acceptSuggestion, setSuggestion, status, statusLabel,
  roundsCompleted, roundGoal, radius, circumference, progress, mm, ss, mode, MODES, durations, durationFill,
  adjustDuration, editingGoal, setEditingGoal, setRoundGoal, switchMode, stop, pause, resume, start, reset,
  aiSuggestion, applyAiSuggestion, sessionTopic, setSessionTopic, setPickerOpen,
  outerRadius, outerCircumference, dailyProgress, todayMinutes, completedToday, showDots, setShowDots,
}) {
  const accent = sessionTopic ? accentForCourse(sessionTopic.topic.id) : null;

  return (
    <>
      <div className="row" style={{ marginBottom: 4 }}>
        <div className="annot" style={{ margin: 0 }}>Study room</div>
        <button type="button" className="ghost icon-btn" onClick={() => setStatsNotice(true)} aria-label="Session history and stats">
          <ChartIcon size={16} />
        </button>
      </div>

      {statsNotice && (
        <div className="notice" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{todayMinutes} min focused today · {completedToday.length} round{completedToday.length === 1 ? '' : 's'} completed.</span>
          <button className="ghost icon-btn" onClick={() => setStatsNotice(false)} aria-label="Dismiss"><CloseIcon size={13} /></button>
        </div>
      )}

      {suggestion && (
        <div className="notice ok study-suggestion">
          <span>
            {suggestion.nextMode === 'pomodoro'
              ? "Break's over — back to focus?"
              : `Nice work! Take a ${suggestion.nextMode === 'long' ? 'long' : 'short'} break?`}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="ghost" onClick={acceptSuggestion}>
              {suggestion.nextMode === 'pomodoro' ? 'Start focus' : 'Start break'}
            </button>
            <button className="ghost" onClick={() => setSuggestion(null)}>Skip</button>
          </div>
        </div>
      )}

      {/* Session context — what this round is actually for. Prominent
          on purpose: the whole point is "25:00 on Memory Hierarchies,"
          not just 25:00. */}
      {status === 'idle' && (
        sessionTopic ? (
          <button className="study-context-card is-active" style={accent ? { '--cp-accent': accent.solid, '--cp-accent-tint': accent.tint, '--cp-accent-deep': accent.deep } : undefined} onClick={() => setPickerOpen(true)}>
            <span className="study-context-icon"><SubjectIcon title={sessionTopic.topic.title} size={18} /></span>
            <span className="study-context-body">
              <span className="study-context-label">Focusing on</span>
              <span className="study-context-title">{sessionTopic.topic.title}</span>
              {sessionTopic.item && <span className="study-context-item">{sessionTopic.item.title}</span>}
            </span>
            <span className="study-context-change">Change</span>
          </button>
        ) : (
          <button className="study-context-card" onClick={() => setPickerOpen(true)}>
            <span className="study-context-body">
              <span className="study-context-title">What are you focusing on?</span>
              <span className="study-context-item">Pick a topic from Course Planner</span>
            </span>
            <span className="study-context-change">Pick</span>
          </button>
        )
      )}

      <div className="card study-card">
        <div className="row" style={{ marginBottom: 18 }}>
          <span className={`stamp study-status-pill status-${status}`}>{statusLabel}</span>
          <span className="study-round-count">{roundsCompleted % roundGoal}/{roundGoal}</span>
        </div>

        {status !== 'idle' && sessionTopic && (
          <div className="study-active-topic">
            <SubjectIcon title={sessionTopic.topic.title} size={15} /> {sessionTopic.topic.title}
          </div>
        )}

        <div className="timer-ring-wrap">
          <svg viewBox="0 0 220 220" className="timer-ring timer-ring-outer">
            <circle cx="110" cy="110" r={outerRadius} className="timer-ring-track-outer" />
            <circle
              cx="110" cy="110" r={outerRadius} className="timer-ring-fill-outer"
              strokeDasharray={outerCircumference}
              strokeDashoffset={outerCircumference * (1 - dailyProgress)}
              transform="rotate(-90 110 110)"
            />
          </svg>
          <svg viewBox="0 0 200 200" className="timer-ring">
            <circle cx="100" cy="100" r={radius} className="timer-ring-track" />
            <circle
              cx="100" cy="100" r={radius} className="timer-ring-fill"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              transform="rotate(-90 100 100)"
            />
          </svg>
          <div className="timer-ring-center">
            <span className="timer-display">{mm}:{ss}</span>
            <span className="timer-mode-label">{MODES[mode].label}</span>
          </div>
        </div>
        <p className="timer-daily-caption">{todayMinutes} / {DAILY_GOAL_MINUTES} min today</p>

        <div className="duration-editor">
          <button className="ghost icon-btn" onClick={() => adjustDuration(-5)} disabled={status !== 'idle'} aria-label="Decrease duration">−</button>
          <div className="duration-fill-track">
            <div className="duration-fill-bar" style={{ width: `${durationFill}%` }} />
            <span className="duration-fill-label">{durations[mode]} min total</span>
          </div>
          <button className="ghost icon-btn" onClick={() => adjustDuration(5)} disabled={status !== 'idle'} aria-label="Increase duration">+</button>
        </div>

        <div className="round-dots-row">
          <button className="round-dots" onClick={() => setShowDots(v => !v)} aria-label="Today's rounds" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
            {Array.from({ length: roundGoal }, (_, i) => (
              <span key={i} className={`round-dot ${i < roundsCompleted % roundGoal ? 'is-filled' : ''}`} />
            ))}
          </button>
          {editingGoal ? (
            <div className="row" style={{ gap: 6 }}>
              <button className="ghost icon-btn" onClick={() => setRoundGoal(g => Math.max(2, g - 1))} aria-label="Fewer rounds">−</button>
              <button className="ghost icon-btn" onClick={() => setRoundGoal(g => Math.min(8, g + 1))} aria-label="More rounds">+</button>
              <button className="ghost" onClick={() => setEditingGoal(false)}>Done</button>
            </div>
          ) : (
            <button className="ghost" onClick={() => setEditingGoal(true)}>Edit</button>
          )}
        </div>

        {showDots && (
          <div className="session-log">
            {completedToday.length === 0 ? (
              <p className="session-log-empty">No completed rounds yet today.</p>
            ) : completedToday.map(s => (
              <div key={s.id} className="session-log-row">
                <span>{new Date(s.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                <span>{s.planned_minutes} min</span>
              </div>
            ))}
          </div>
        )}

        <div className="chip-row study-segmented">
          {Object.entries(MODES).map(([key, m]) => (
            <button key={key} className={`chip ${mode === key ? 'chip-on' : ''}`} onClick={() => switchMode(key)}>
              {m.label}
            </button>
          ))}
        </div>

        {status === 'idle' && sessionTopic && mode === 'pomodoro' && (
          <p className="study-dnd-hint">Phone face-down, notifications off — you've got {durations.pomodoro} minutes.</p>
        )}

        <div className="study-transport">
          <button className="ghost icon-btn" onClick={stop} aria-label="Stop"><StopIcon size={16} /></button>
          {status === 'running' ? (
            <button className="study-transport-main" onClick={pause} aria-label="Pause"><PauseIcon size={22} /></button>
          ) : (
            <button className="study-transport-main" onClick={status === 'paused' ? resume : start} aria-label="Start">
              <PlayIcon size={22} />
            </button>
          )}
          <button className="ghost icon-btn" onClick={reset} aria-label="Reset"><ResetIcon size={16} /></button>
        </div>

        <div className="ai-suggest-card">
          <div className="ai-suggest-header"><SparkleIcon size={13} /> AI Suggests</div>
          <div className="ai-suggest-body">
            <span className="ai-suggest-icon"><SparkleIcon size={16} /></span>
            <div style={{ flex: 1 }}>
              <h4>{aiSuggestion ? aiSuggestion.title : 'No active suggestions'}</h4>
              <p>{aiSuggestion ? aiSuggestion.body : 'The break prompt above already covers what to do next.'}</p>
              {aiSuggestion?.cta && (
                <button className="ai-suggest-cta" onClick={() => applyAiSuggestion(aiSuggestion.cta)}>{aiSuggestion.cta.label}</button>
              )}
            </div>
          </div>
        </div>
        <p className="study-sound-note">Suggestions are simple on-device rules for now, not a live AI call.</p>
      </div>
    </>
  );
}

function TopicPicker({ topics, onPick, onClose }) {
  const [expanded, setExpanded] = useState(null);
  const sorted = [...topics].sort((a, b) => a.mastery - b.mastery);

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="row" style={{ marginBottom: 10 }}>
          <h3 style={{ fontSize: 16 }}>What are you focusing on?</h3>
          <button className="ghost icon-btn" onClick={onClose} aria-label="Close"><CloseIcon size={16} /></button>
        </div>

        {sorted.length === 0 ? (
          <p className="session-log-empty">No courses in Course Planner yet — add one there first.</p>
        ) : (
          <div className="topic-picker-list">
            {sorted.map(t => {
              const accent = accentForCourse(t.id);
              const unrated = t.items.filter(i => i.confidence_rating == null || i.confidence_rating <= 2);
              const isOpen = expanded === t.id;
              return (
                <div key={t.id} className="topic-picker-item" style={{ '--cp-accent': accent.solid, '--cp-accent-tint': accent.tint, '--cp-accent-deep': accent.deep }}>
                  <button className="topic-picker-row" onClick={() => setExpanded(isOpen ? null : t.id)}>
                    <span className="topic-picker-icon"><SubjectIcon title={t.title} size={17} /></span>
                    <span className="topic-picker-body">
                      <span className="topic-picker-title">{t.title}</span>
                      <span className="topic-picker-meta">{t.courseName} · {Math.round(t.mastery * 100)}% done</span>
                    </span>
                  </button>
                  {isOpen && (
                    <div className="item-chip-row">
                      <button className="item-chip" onClick={() => onPick(t, null)}>Whole topic</button>
                      {unrated.slice(0, 4).map(i => (
                        <button key={i.id} className="item-chip" onClick={() => onPick(t, i)}>{i.title}</button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SessionRecap({ recap, onClose }) {
  const [finished, setFinished] = useState(null);
  const [confidence, setConfidence] = useState(null);

  const label = confidence === 1 ? 'shaky on it' : confidence === 3 ? 'getting there' : confidence === 5 ? 'confident' : '';
  const note = recap.topic
    ? `Studied ${recap.topic.title}${recap.item ? ' — ' + recap.item.title : ''}${label ? ', felt ' + label : ''}.`
    : null;

  const away = Math.round(recap.distraction.seconds);
  const awayMin = Math.floor(away / 60);
  const awaySec = away % 60;

  return (
    <div className="sheet-overlay">
      <div className="sheet">
        <div className="sheet-handle" />
        <h3 style={{ fontSize: 16, marginBottom: 4 }}>Round complete</h3>
        <p className="recap-summary">
          {recap.topic ? (
            <><strong>{recap.topic.title}</strong>{recap.item ? ` — ${recap.item.title}` : ''}, {recap.minutes} minutes.</>
          ) : (
            `Untethered focus session, ${recap.minutes} minutes.`
          )}
        </p>

        {recap.distraction.count > 0 && (
          <p className="distraction-note">
            You left the app {recap.distraction.count} time{recap.distraction.count === 1 ? '' : 's'} — {awayMin > 0 ? `${awayMin}m ` : ''}{awaySec}s total away.
          </p>
        )}

        {recap.topic && (
          <>
            <div className="recap-block">
              <span className="recap-label">Did you finish this?</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className={`recap-yn ${finished === true ? 'is-active' : ''}`} onClick={() => setFinished(true)}>Yes</button>
                <button className={`recap-yn ${finished === false ? 'is-active' : ''}`} onClick={() => setFinished(false)}>Not quite</button>
              </div>
            </div>

            <div className="recap-block cp-scope cp-scope--inline">
              <span className="cp-face-label" style={{ display: 'block', marginBottom: 8 }}>How confident do you feel now?</span>
              <div className="cp-face-row">
                {CONFIDENCE_LEVELS.map(lvl => {
                  const Face = FACES[lvl.value];
                  return (
                    <button key={lvl.value} className={`cp-face-btn ${confidence === lvl.value ? 'is-active' : ''}`} onClick={() => setConfidence(lvl.value)}>
                      <Face size={22} /><span>{lvl.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <button className="primary" style={{ marginTop: 14 }} onClick={() => onClose({ finished, confidence, note })}>
          {finished === false ? 'Continue this topic' : recap.isLongDue ? 'Take a long break' : 'Done'}
        </button>
      </div>
    </div>
  );
}
