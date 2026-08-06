import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { UserIcon, IdCardIcon, SignOutIcon, BellIcon } from './Icons';

export default function Profile({ userId, email }) {
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [program, setProgram] = useState('');
  const [intakeYear, setIntakeYear] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [reviewReminders, setReviewReminders] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const [{ data, error }, { data: prefs }] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('notification_preferences').select('review_reminders').eq('user_id', userId).maybeSingle(),
    ]);
    if (error) { setErr(error.message); setLoaded(true); return; }
    if (data) {
      setFullName(data.full_name ?? '');
      setStudentId(data.student_id ?? '');
      setProgram(data.program ?? '');
      setIntakeYear(data.intake_year ?? '');
    } else {
      setEditing(true); // no profile yet — go straight to the form
    }
    if (prefs) setReviewReminders(prefs.review_reminders);
    setLoaded(true);
  }

  async function toggleReviewReminders() {
    const next = !reviewReminders;
    setReviewReminders(next); // optimistic — flip back below if the write fails
    const { error } = await supabase.from('notification_preferences').upsert({ user_id: userId, review_reminders: next });
    if (error) { setErr(error.message); setReviewReminders(!next); }
  }

  async function save() {
    setBusy(true); setErr('');
    const { error } = await supabase.from('profiles').upsert({
      user_id: userId,
      full_name: fullName.trim(),
      student_id: studentId.trim(),
      program: program.trim(),
      intake_year: intakeYear.trim(),
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setEditing(false);
  }

  const initials = (fullName || email || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

  if (!loaded) return <div className="annot">Profile</div>;

  return (
    <>
      <div className="annot">Profile</div>

      {err && <div className="notice err">{err}</div>}

      {!editing && (
        <div className="card id-card">
          <div className="id-card-top">
            <div className="id-avatar">{initials}</div>
            <div>
              <h3 style={{ fontSize: 17 }}>{fullName || 'Student'}</h3>
              <div className="stamp badge-neutral" style={{ marginTop: 6 }}>{email}</div>
            </div>
          </div>
          <div className="id-card-grid">
            <div><span className="id-label">Student ID</span><span className="id-value">{studentId || '—'}</span></div>
            <div><span className="id-label">Program</span><span className="id-value">{program || '—'}</span></div>
            <div><span className="id-label">Intake</span><span className="id-value">{intakeYear || '—'}</span></div>
          </div>
          <div className="id-card-footer">
            <IdCardIcon size={14} /> German University of Technology in Oman
          </div>
        </div>
      )}

      {editing ? (
        <div className="card">
          <label htmlFor="pn">Full name</label>
          <input id="pn" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" />

          <label htmlFor="ps">Student ID</label>
          <input id="ps" value={studentId} onChange={e => setStudentId(e.target.value)} placeholder="e.g. 20231234" />

          <label htmlFor="pp">Program</label>
          <input id="pp" value={program} onChange={e => setProgram(e.target.value)} placeholder="e.g. Computer Science" />

          <label htmlFor="pi">Intake year</label>
          <input id="pi" value={intakeYear} onChange={e => setIntakeYear(e.target.value)} placeholder="e.g. 2024" />

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
            {studentId || fullName ? (
              <button className="ghost" onClick={() => { setEditing(false); setErr(''); }}>Cancel</button>
            ) : null}
          </div>
        </div>
      ) : (
        <button className="ghost" onClick={() => setEditing(true)}>
          <UserIcon size={15} /> Edit profile
        </button>
      )}

      <div className="annot">Notifications</div>
      <div className="card notif-pref-row">
        <div className="row" style={{ gap: 10, justifyContent: 'flex-start' }}>
          <BellIcon size={16} />
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>Review reminders</p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              A single notification when Course Planner items are ready for review — never more than once a day.
            </p>
          </div>
        </div>
        <button
          type="button"
          className={`toggle-switch ${reviewReminders ? 'is-on' : ''}`}
          onClick={toggleReviewReminders}
          role="switch"
          aria-checked={reviewReminders}
          aria-label="Review reminders"
        >
          <span className="toggle-knob" />
        </button>
      </div>

      <button className="ghost" style={{ marginTop: 12, color: 'var(--accent-alert)' }} onClick={() => supabase.auth.signOut()}>
        <SignOutIcon size={15} /> Sign out
      </button>
    </>
  );
}
