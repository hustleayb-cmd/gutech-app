import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { MegaphoneIcon, PinIcon } from './Icons';
import AnnouncementArt from './AnnouncementArt';

const CATEGORY_LABEL = { general: 'General', academic: 'Academic', event: 'Event', deadline: 'Deadline' };

export default function Announcements() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [err, setErr] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data, error } = await supabase
      .from('announcements').select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) { setErr(error.message); setLoaded(true); return; }
    setItems(data ?? []);
    setLoaded(true);
  }

  const categories = ['all', ...new Set(items.map(a => a.category))];
  const visible = filter === 'all' ? items : items.filter(a => a.category === filter);

  const fmt = t => new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <>
      <div className="annot">Announcements</div>

      {err && <div className="notice err">{err}</div>}

      {categories.length > 1 && (
        <div className="chip-row">
          {categories.map(c => (
            <button key={c} className={`chip ${filter === c ? 'chip-on' : ''}`} onClick={() => setFilter(c)}>
              {c === 'all' ? 'All' : CATEGORY_LABEL[c] ?? c}
            </button>
          ))}
        </div>
      )}

      {loaded && visible.length === 0 && (
        <div className="empty" style={{ marginTop: 14 }}>
          <div className="k"><MegaphoneIcon size={14} /> Nothing posted yet</div>
          <p>Official updates from GUtech will show up here as soon as they're posted.</p>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        {visible.map(a => (
          <div className={`card announcement-card cat-${a.category}`} key={a.id}>
            <AnnouncementArt category={a.category} seedKey={a.id ?? a.title} />
            <div className="announcement-card-body">
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div className="row" style={{ gap: 8, justifyContent: 'flex-start' }}>
                  {a.pinned && <PinIcon size={14} className="pin-icon" />}
                  <span className={`stamp badge-cat-${a.category}`}>{CATEGORY_LABEL[a.category] ?? a.category}</span>
                </div>
                <span className="announcement-date">{fmt(a.created_at)}</span>
              </div>
              <h3 style={{ marginTop: 10 }}>{a.title}</h3>
              {a.body && <p>{a.body}</p>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
