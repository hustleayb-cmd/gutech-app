import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { colorForIndex, initials } from '../lib/roomColors';
import { PlusIcon, UsersIcon, CalendarIcon, ChartIcon, PinIcon, ChevronLeft } from './Icons';

const ROLE_OPTIONS = ['Lead', 'Researcher', 'Designer', 'Writer', 'Presenter'];

// Phase 1 scope (staged build order, same pattern as Study Room): the
// rooms dashboard + room overview screen only. No Kanban board yet —
// task_checklist_items/project_tasks already exist in the schema so the
// board (phase 3) can be built straight on top without any backend
// rework, but nothing reads them yet.
export default function Projects({ userId, email }) {
  const [rooms, setRooms] = useState([]);
  const [openRoomId, setOpenRoomId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [err, setErr] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { loadRooms(); }, []);

  async function loadRooms() {
    const { data: memberships, error: mErr } = await supabase
      .from('room_members').select('room_id').eq('user_id', userId).eq('status', 'accepted');
    if (mErr) { setErr(mErr.message); setLoaded(true); return; }

    const roomIds = (memberships ?? []).map(m => m.room_id);
    if (roomIds.length === 0) { setRooms([]); setLoaded(true); return; }

    const [{ data: roomRows, error: rErr }, { data: memberRows, error: mrErr }] = await Promise.all([
      supabase.from('project_rooms').select('*').in('id', roomIds).order('created_at', { ascending: false }),
      supabase.from('room_members').select('*').in('room_id', roomIds).eq('status', 'accepted'),
    ]);
    if (rErr) { setErr(rErr.message); setLoaded(true); return; }
    if (mrErr) { setErr(mrErr.message); setLoaded(true); return; }

    const withMembers = (roomRows ?? []).map(r => ({
      ...r,
      members: (memberRows ?? []).filter(m => m.room_id === r.id),
    }));
    setRooms(withMembers);
    setLoaded(true);
  }

  async function createRoom() {
    if (!title.trim()) { setErr('Give the room a name.'); return; }
    setErr('');
    const { data, error } = await supabase
      .from('project_rooms')
      .insert({ title: title.trim(), description: description.trim(), due_date: dueDate || null, created_by: userId })
      .select()
      .single();
    if (error) { setErr(error.message); return; }
    setTitle(''); setDescription(''); setDueDate(''); setCreating(false);
    await loadRooms();
    setOpenRoomId(data.id);
  }

  if (openRoomId) {
    const room = rooms.find(r => r.id === openRoomId);
    return (
      <RoomOverview
        room={room}
        userId={userId}
        email={email}
        onBack={() => { setOpenRoomId(null); loadRooms(); }}
      />
    );
  }

  return (
    <>
      <div className="annot">Project Rooms</div>

      {err && <div className="notice err">{err}</div>}

      {creating ? (
        <div className="card">
          <label htmlFor="rmt">Room name</label>
          <input id="rmt" value={title} onChange={e => setTitle(e.target.value)} placeholder="Senior capstone project" />

          <label htmlFor="rmd">Description (optional)</label>
          <textarea id="rmd" value={description} onChange={e => setDescription(e.target.value)} placeholder="What's this project about?" />

          <label htmlFor="rmdue">Due date (optional)</label>
          <input id="rmdue" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="primary" onClick={createRoom}>Create room</button>
            <button className="ghost" onClick={() => { setCreating(false); setErr(''); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="primary" onClick={() => setCreating(true)}>
          <PlusIcon size={16} /> New Project Room
        </button>
      )}

      {loaded && rooms.length === 0 && !creating && (
        <div className="empty" style={{ marginTop: 14 }}>
          <div className="k"><UsersIcon size={14} /> No rooms yet</div>
          <p>Create a room to start planning a project with your team.</p>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        {rooms.map(room => (
          <div key={room.id} className="card room-card" onClick={() => setOpenRoomId(room.id)} role="button" tabIndex={0}>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <h3 style={{ fontSize: 16 }}>{room.title}</h3>
              {room.due_date && (
                <span className="stamp badge-neutral">
                  <CalendarIcon size={11} /> {new Date(room.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                </span>
              )}
            </div>
            {room.description && <p>{room.description}</p>}
            <div className="row" style={{ marginTop: 12 }}>
              <div className="avatar-stack">
                {room.members.slice(0, 5).map(m => (
                  <span key={m.id} className="avatar-chip" style={{ background: colorForIndex(m.color_index) }}>
                    {initials(m.user_id === userId ? email : m.user_id)}
                  </span>
                ))}
              </div>
              <span className="room-progress-mini">0% complete</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function RoomOverview({ room, userId, email, onBack }) {
  const [members, setMembers] = useState(room?.members ?? []);
  const [err, setErr] = useState('');

  useEffect(() => { setMembers(room?.members ?? []); }, [room]);

  if (!room) {
    return (
      <>
        <button className="ghost" onClick={onBack}><ChevronLeft size={14} /> Back</button>
        <div className="notice err" style={{ marginTop: 14 }}>Room not found.</div>
      </>
    );
  }

  async function changeRole(memberId, role) {
    const { error } = await supabase.from('room_members').update({ role }).eq('id', memberId);
    if (error) { setErr(error.message); return; }
    setMembers(prev => prev.map(m => (m.id === memberId ? { ...m, role } : m)));
  }

  return (
    <>
      <button className="ghost" onClick={onBack} style={{ marginBottom: 14 }}>
        <ChevronLeft size={14} /> All rooms
      </button>

      {err && <div className="notice err">{err}</div>}

      <div className="row" style={{ alignItems: 'flex-start' }}>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>{room.title}</h2>
        <button className="ghost" disabled title="Invites are coming in a later update">
          <UsersIcon size={14} /> Invite
        </button>
      </div>

      <div className="avatar-stack" style={{ marginTop: 10, marginBottom: 4 }}>
        {members.map(m => (
          <span key={m.id} className="avatar-chip" style={{ background: colorForIndex(m.color_index) }}>
            {initials(m.user_id === userId ? email : m.user_id)}
          </span>
        ))}
      </div>

      <div className="card study-card" style={{ marginTop: 14 }}>
        {room.description && <p style={{ marginTop: 0 }}>{room.description}</p>}
        {room.due_date && (
          <div className="stamp badge-neutral" style={{ marginTop: 8 }}>
            <CalendarIcon size={11} /> Due {new Date(room.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <div className="row" style={{ marginBottom: 6 }}>
            <span className="room-progress-label"><ChartIcon size={12} /> Room progress</span>
            <span className="room-progress-label">0%</span>
          </div>
          <div className="room-progress-track">
            <div className="room-progress-fill" style={{ width: '0%' }} />
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
            No tasks yet — the board is coming in the next update.
          </p>
        </div>
      </div>

      <div className="annot">Roles</div>
      {members.map(m => (
        <div key={m.id} className="card role-row">
          <span className="avatar-chip" style={{ background: colorForIndex(m.color_index) }}>
            {initials(m.user_id === userId ? email : m.user_id)}
          </span>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>
            {m.user_id === userId ? `${email.split('@')[0]} (you)` : 'Teammate'}
          </span>
          <select value={m.role} onChange={e => changeRole(m.id, e.target.value)} style={{ width: 130, margin: 0 }}>
            {[...new Set([m.role, ...ROLE_OPTIONS])].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      ))}

      <div className="annot">Up next</div>
      <div className="empty">
        <div className="k"><PinIcon size={14} /> Nothing flagged yet</div>
        <p>Tasks marked "Tackle first" on the board will show up here — the board is coming in the next update.</p>
      </div>

      <div className="notice" style={{ marginTop: 16 }}>
        Kanban board, checklists, invites, and activity feed are being built next — this is the room overview only.
      </div>
    </>
  );
}
