import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

const KINDS = ['general', 'assignment', 'exam', 'fee payment', 'registration'];

export default function Reminders({ userId, onCount }) {
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [kind, setKind] = useState('general');
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { load(); }, []);

  // fire a browser notification for anything that just came due
  useEffect(() => {
    const fired = new Set();
    const t = setInterval(() => {
      const now = Date.now();
      items.forEach(r => {
        if (r.done || fired.has(r.id)) return;
        const d = new Date(r.due_at).getTime();
        if (d <= now && d > now - 120000) {
          fired.add(r.id);
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('GUtech reminder', { body: r.title });
          }
        }
      });
    }, 30000);
    return () => clearInterval(t);
  }, [items]);

  async function load() {
    const { data, error } = await supabase
      .from('reminders').select('*').order('due_at', { ascending: true });
    if (error) { setErr(error.message); return; }
    setItems(data ?? []);
    onCount?.((data ?? []).filter(r => !r.done).length);
  }

  async function add() {
    if (!title.trim()) { setErr('Give the reminder a name.'); return; }
    if (!due) { setErr('Pick a date and time.'); return; }
    setErr('');

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const { error } = await supabase.from('reminders').insert({
      user_id: userId, title: title.trim(), due_at: new Date(due).toISOString(), kind,
    });
    if (error) { setErr(error.message); return; }
    setTitle(''); setDue(''); setKind('general'); setOpen(false);
    load();
  }

  async function toggle(r) {
    const { error } = await supabase.from('reminders')
      .update({ done: !r.done }).eq('id', r.id);
    if (error) { setErr(error.message); return; }
    load();
  }

  async function remove(id) {
    const { error } = await supabase.from('reminders').delete().eq('id', id);
    if (error) { setErr(error.message); return; }
    load();
  }

  const fmt = t => new Date(t).toLocaleString('en-GB',
    { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });

  const until = t => {
    const ms = new Date(t) - Date.now();
    if (ms < 0) return 'overdue';
    const d = Math.floor(ms / 86400000);
    if (d > 0) return `in ${d} day${d > 1 ? 's' : ''}`;
    const h = Math.floor(ms / 3600000);
    if (h > 0) return `in ${h} hour${h > 1 ? 's' : ''}`;
    return 'within the hour';
  };

  return (
    <>
      <div className="annot">Reminders</div>

      {err && <div className="notice err">{err}</div>}

      {open ? (
        <div className="card">
          <label htmlFor="rt">What is it</label>
          <input id="rt" value={title} onChange={e => setTitle(e.target.value)}
                 placeholder="Submit CS assignment 2" />

          <label htmlFor="rd">Due</label>
          <input id="rd" type="datetime-local" value={due} onChange={e => setDue(e.target.value)} />

          <label htmlFor="rk">Type</label>
          <select id="rk" value={kind} onChange={e => setKind(e.target.value)}>
            {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
          </select>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="primary" onClick={add}>Save reminder</button>
            <button className="ghost" onClick={() => { setOpen(false); setErr(''); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="primary" onClick={() => setOpen(true)}>Add a reminder</button>
      )}

      {items.length === 0 && !open && (
        <div className="empty" style={{ marginTop: 14 }}>
          <div className="k">Nothing scheduled</div>
          <p>Add assignment deadlines, exam dates or fee payments and this device
             will notify you when they come due.</p>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        {items.map(r => {
          const overdue = !r.done && new Date(r.due_at) < new Date();
          return (
            <div className={`card ${r.done ? 'done' : overdue ? 'due' : 'tick'}`} key={r.id}>
              <div className="row">
                <h3 style={{ textDecoration: r.done ? 'line-through' : 'none' }}>{r.title}</h3>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="ghost ok" onClick={() => toggle(r)}>
                    {r.done ? 'Undo' : 'Done'}
                  </button>
                  <button className="ghost" onClick={() => remove(r.id)}>Delete</button>
                </div>
              </div>
              <div className="stamp" style={{ marginTop: 5 }}>
                {r.kind} · {fmt(r.due_at)} · {r.done ? 'completed' : until(r.due_at)}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
