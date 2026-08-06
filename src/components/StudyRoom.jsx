import { useEffect, useRef, useState } from 'react';
import CoursePlanner from './CoursePlanner';
import { PlayIcon, PauseIcon, StopIcon, ResetIcon, ChartIcon, CloseIcon, SparkleIcon, TimerIcon, SparkleIcon as PlannerIcon } from './Icons';

// Phase 1 scope (per the staged build order): the live timer card only —
// no task list, no chapters, no stats yet. Settings live in local state
// for now; they'll move to a Supabase-backed `study_settings` row once
// the task list (phase 2) gives them something to actually attach to.
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

export default function StudyRoom({ userId }) {
  const [section, setSection] = useState('timer'); // 'timer' | 'courses'
  const [durations, setDurations] = useState({ pomodoro: 25, short: 5, long: 15 });
  const [mode, setMode] = useState('pomodoro');
  const [status, setStatus] = useState('idle'); // idle | running | paused
  const [msLeft, setMsLeft] = useState(durations.pomodoro * 60 * 1000);
  const [roundGoal, setRoundGoal] = useState(4);
  const [roundsCompleted, setRoundsCompleted] = useState(0);
  const [editingGoal, setEditingGoal] = useState(false);
  const [suggestion, setSuggestion] = useState(null); // { nextMode } | null
  const [statsNotice, setStatsNotice] = useState(false);

  const endTimeRef = useRef(null);

  // Keep the displayed time in sync with whatever mode/duration is
  // selected while idle (so editing duration or switching modes updates
  // the ring immediately, before the first Start).
  useEffect(() => {
    if (status === 'idle') setMsLeft(durations[mode] * 60 * 1000);
  }, [mode, durations, status]);

  // Ticking — updates every 250ms; the ring's CSS transition smooths the
  // steps into what reads as continuous motion rather than a jump-per-tick.
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

  function handleSessionComplete() {
    setStatus('idle');
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Study Room', {
        body: mode === 'pomodoro' ? 'Pomodoro complete — nice work.' : 'Break\'s over.',
      });
    }

    if (mode === 'pomodoro') {
      const nextCount = roundsCompleted + 1;
      setRoundsCompleted(nextCount);
      const isLongDue = nextCount % roundGoal === 0;
      setSuggestion({ nextMode: isLongDue ? 'long' : 'short' });
    } else {
      if (mode === 'long') setRoundsCompleted(0);
      setSuggestion({ nextMode: 'pomodoro' });
    }
  }

  function start() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    endTimeRef.current = Date.now() + msLeft;
    setStatus('running');
    setSuggestion(null);
  }

  function pause() {
    setStatus('paused');
  }

  function resume() {
    endTimeRef.current = Date.now() + msLeft;
    setStatus('running');
  }

  function stop() {
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
    if (status !== 'idle') return; // don't rewrite a running/paused session out from under itself
    setDurations(prev => ({
      ...prev,
      [mode]: Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, prev[mode] + delta)),
    }));
  }

  function acceptSuggestion() {
    switchMode(suggestion.nextMode);
  }

  const totalMs = durations[mode] * 60 * 1000;
  const progress = totalMs > 0 ? 1 - msLeft / totalMs : 0;
  const radius = 92;
  const circumference = 2 * Math.PI * radius;

  const mm = String(Math.floor(msLeft / 60000)).padStart(2, '0');
  const ss = String(Math.floor((msLeft % 60000) / 1000)).padStart(2, '0');

  const statusLabel = status === 'running' ? 'Focusing' : status === 'paused' ? 'Paused' : 'Ready';
  const durationFill = ((durations[mode] - MIN_MINUTES) / (MAX_MINUTES - MIN_MINUTES)) * 100;

  // Simple on-device heuristic, not a live model call — see the note
  // rendered under the card. Suppressed while the break-suggestion
  // banner above is already showing something to act on, so the two
  // don't say two different things at once.
  const aiSuggestion = suggestion
    ? null
    : status === 'running'
    ? { title: 'Stay with it', body: `${MODES[mode].label} in progress — you're doing great.` }
    : status === 'paused'
    ? { title: "Whenever you're ready", body: 'Resume to pick up right where you left off.' }
    : roundsCompleted === 0
    ? { title: 'Start your first round', body: 'A 25-minute Pomodoro is a solid way to begin.' }
    : { title: `${roundsCompleted} round${roundsCompleted === 1 ? '' : 's'} today`, body: "Nice pace — start another whenever you're ready." };

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

      {section === 'courses' ? <CoursePlanner userId={userId} /> : <TimerSection
        statsNotice={statsNotice} setStatsNotice={setStatsNotice}
        suggestion={suggestion} acceptSuggestion={acceptSuggestion} setSuggestion={setSuggestion}
        status={status} statusLabel={statusLabel} roundsCompleted={roundsCompleted} roundGoal={roundGoal}
        radius={radius} circumference={circumference} progress={progress} mm={mm} ss={ss} mode={mode} MODES={MODES}
        durations={durations} durationFill={durationFill} adjustDuration={adjustDuration}
        editingGoal={editingGoal} setEditingGoal={setEditingGoal} setRoundGoal={setRoundGoal}
        switchMode={switchMode} stop={stop} pause={pause} resume={resume} start={start} reset={reset}
        aiSuggestion={aiSuggestion}
      />}
    </>
  );
}

function TimerSection({
  statsNotice, setStatsNotice, suggestion, acceptSuggestion, setSuggestion, status, statusLabel,
  roundsCompleted, roundGoal, radius, circumference, progress, mm, ss, mode, MODES, durations, durationFill,
  adjustDuration, editingGoal, setEditingGoal, setRoundGoal, switchMode, stop, pause, resume, start, reset, aiSuggestion,
}) {
  return (
    <>
      <div className="row" style={{ marginBottom: 4 }}>
        <div className="annot" style={{ margin: 0 }}>Study room</div>
        <button
          type="button"
          className="ghost icon-btn"
          onClick={() => setStatsNotice(true)}
          aria-label="Session history and stats"
        >
          <ChartIcon size={16} />
        </button>
      </div>

      {statsNotice && (
        <div className="notice" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Session history & streaks are coming in the next update.</span>
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

      <div className="card study-card">
        <div className="row" style={{ marginBottom: 18 }}>
          <span className={`stamp study-status-pill status-${status}`}>{statusLabel}</span>
          <span className="study-round-count">{roundsCompleted % roundGoal}/{roundGoal}</span>
        </div>

        <div className="timer-ring-wrap">
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

        <div className="duration-editor">
          <button className="ghost icon-btn" onClick={() => adjustDuration(-5)} disabled={status !== 'idle'} aria-label="Decrease duration">−</button>
          <div className="duration-fill-track">
            <div className="duration-fill-bar" style={{ width: `${durationFill}%` }} />
            <span className="duration-fill-label">{durations[mode]} min total</span>
          </div>
          <button className="ghost icon-btn" onClick={() => adjustDuration(5)} disabled={status !== 'idle'} aria-label="Increase duration">+</button>
        </div>

        <div className="round-dots-row">
          <div className="round-dots">
            {Array.from({ length: roundGoal }, (_, i) => (
              <span key={i} className={`round-dot ${i < roundsCompleted % roundGoal ? 'is-filled' : ''}`} />
            ))}
          </div>
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

        <div className="chip-row study-segmented">
          {Object.entries(MODES).map(([key, m]) => (
            <button key={key} className={`chip ${mode === key ? 'chip-on' : ''}`} onClick={() => switchMode(key)}>
              {m.label}
            </button>
          ))}
        </div>

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
            <div>
              <h4>{aiSuggestion ? aiSuggestion.title : 'No active suggestions'}</h4>
              <p>{aiSuggestion ? aiSuggestion.body : 'The break prompt above already covers what to do next.'}</p>
            </div>
          </div>
        </div>
        <p className="study-sound-note">Suggestions are simple on-device rules for now, not a live AI call.</p>
      </div>
    </>
  );
}
