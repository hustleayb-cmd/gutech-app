import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { computeGPA, GRADE_OPTIONS } from '../lib/gpa';
import { PlusIcon, TrashIcon, ChartIcon } from './Icons';

export default function Grades({ userId }) {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [course, setCourse] = useState('');
  const [creditHours, setCreditHours] = useState('3');
  const [grade, setGrade] = useState('A');
  const [term, setTerm] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data, error } = await supabase
      .from('grades').select('*').order('created_at', { ascending: false });
    if (error) { setErr(error.message); return; }
    setRows(data ?? []);
  }

  async function add() {
    if (!course.trim()) { setErr('Give the course a name or code.'); return; }
    if (!GRADE_OPTIONS.includes(grade)) { setErr('Pick a valid letter grade.'); return; }
    const hours = Number(creditHours);
    if (!hours || hours <= 0) { setErr('Credit hours must be a positive number.'); return; }

    setErr('');
    const { error } = await supabase.from('grades').insert({
      user_id: userId, course: course.trim(), credit_hours: hours, grade, term: term.trim(),
    });
    if (error) { setErr(error.message); return; }
    setCourse(''); setCreditHours('3'); setGrade('A'); setTerm(''); setOpen(false);
    load();
  }

  async function remove(id) {
    const { error } = await supabase.from('grades').delete().eq('id', id);
    if (error) { setErr(error.message); return; }
    load();
  }

  const { gpa, hours } = computeGPA(rows);
  const pct = Math.min(gpa / 4, 1);
  const circumference = 2 * Math.PI * 42;

  return (
    <>
      <div className="annot">Grades</div>

      {err && <div className="notice err">{err}</div>}

      <div className="card gpa-card">
        <div className="gpa-ring-wrap">
          <svg viewBox="0 0 100 100" className="gpa-ring">
            <circle cx="50" cy="50" r="42" className="gpa-ring-track" />
            <circle
              cx="50" cy="50" r="42" className="gpa-ring-fill"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - pct)}
            />
          </svg>
          <div className="gpa-ring-center">
            <span className="gpa-ring-value">{rows.length ? gpa.toFixed(2) : '—'}</span>
            <span className="gpa-ring-label">GPA</span>
          </div>
        </div>
        <div className="gpa-side">
          <div className="gpa-stat"><span className="gpa-stat-num">{rows.length}</span><span>Courses</span></div>
          <div className="gpa-stat"><span className="gpa-stat-num">{hours}</span><span>Credit hrs</span></div>
        </div>
      </div>

      {open ? (
        <div className="card">
          <label htmlFor="gc">Course</label>
          <input id="gc" value={course} onChange={e => setCourse(e.target.value)} placeholder="CS 2210 — Data Structures" />

          <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="gg">Grade</label>
              <select id="gg" value={grade} onChange={e => setGrade(e.target.value)}>
                {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="gh">Credit hours</label>
              <input id="gh" type="number" min="0.5" step="0.5" value={creditHours}
                     onChange={e => setCreditHours(e.target.value)} />
            </div>
          </div>

          <label htmlFor="gt">Term (optional)</label>
          <input id="gt" value={term} onChange={e => setTerm(e.target.value)} placeholder="Fall 2026" />

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="primary" onClick={add}>Save grade</button>
            <button className="ghost" onClick={() => { setOpen(false); setErr(''); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="primary" onClick={() => setOpen(true)}>
          <PlusIcon size={16} /> Add a course grade
        </button>
      )}

      {rows.length === 0 && !open && (
        <div className="empty" style={{ marginTop: 14 }}>
          <div className="k"><ChartIcon size={14} /> No grades yet</div>
          <p>Log a course and its grade to start tracking your GPA here — it's calculated locally from what you enter.</p>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        {rows.map(r => (
          <div className="card grade-row" key={r.id}>
            <div className="row">
              <div>
                <h3 style={{ fontSize: 15 }}>{r.course}</h3>
                <div className="stamp badge-neutral" style={{ marginTop: 6 }}>
                  {r.term ? `${r.term} · ` : ''}{r.credit_hours} credit hrs
                </div>
              </div>
              <div className="row" style={{ gap: 10 }}>
                <span className="grade-pill">{r.grade}</span>
                <button className="ghost icon-btn" onClick={() => remove(r.id)} aria-label={`Delete ${r.course}`}>
                  <TrashIcon size={15} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
