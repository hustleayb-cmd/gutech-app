import { useEffect, useState } from 'react';
import { supabase, CLUB_JOIN_WEBHOOK } from '../supabase';
import { TrophyIcon, CodeIcon, PaletteIcon, MusicIcon, BriefcaseIcon, GlobeIcon, BookIcon, HeartIcon, UsersIcon, CheckIcon } from './Icons';

// Each category gets its own icon, tint, and hover animation (see the
// .anim-* rules in styles.css) so hovering a card visually "reflects"
// what the club is about — a football bouncing, a globe spinning, etc.
const CATEGORY_META = {
  sport: { label: 'Sport', Icon: TrophyIcon, anim: 'anim-sport', tint: 'tint-success' },
  tech: { label: 'Tech', Icon: CodeIcon, anim: 'anim-tech', tint: 'tint-blue' },
  arts: { label: 'Arts', Icon: PaletteIcon, anim: 'anim-arts', tint: 'tint-purple' },
  music: { label: 'Music', Icon: MusicIcon, anim: 'anim-music', tint: 'tint-lightblue' },
  business: { label: 'Business', Icon: BriefcaseIcon, anim: 'anim-business', tint: 'tint-amber' },
  culture: { label: 'Culture', Icon: GlobeIcon, anim: 'anim-culture', tint: 'tint-success' },
  academic: { label: 'Academic', Icon: BookIcon, anim: 'anim-academic', tint: 'tint-bluedark' },
  volunteering: { label: 'Volunteering', Icon: HeartIcon, anim: 'anim-volunteering', tint: 'tint-alert' },
  general: { label: 'Club', Icon: UsersIcon, anim: 'anim-general', tint: 'tint-blue' },
};

function metaFor(category) {
  return CATEGORY_META[category] || CATEGORY_META.general;
}

export default function Clubs({ userId, email }) {
  const [clubs, setClubs] = useState([]);
  const [joinedIds, setJoinedIds] = useState(new Set());
  const [profile, setProfile] = useState(null);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const [c, m, p] = await Promise.all([
      supabase.from('clubs').select('*').order('name', { ascending: true }),
      supabase.from('club_memberships').select('club_id').eq('user_id', userId),
      supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
    ]);
    if (c.error) { setErr(c.error.message); return; }
    setClubs(c.data ?? []);
    setJoinedIds(new Set((m.data ?? []).map(r => r.club_id)));
    setProfile(p.data ?? null);
  }

  // Best-effort — a confirmation email is a nice-to-have, not something
  // that should block or fail the join itself if n8n is unreachable.
  async function notifyJoin(club) {
    if (!CLUB_JOIN_WEBHOOK) return;
    try {
      await fetch(CLUB_JOIN_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'club_join',
          email,
          full_name: profile?.full_name || '',
          student_id: profile?.student_id || '',
          program: profile?.program || '',
          club_name: club.name,
          club_category: club.category,
        }),
      });
    } catch {
      // Silent — the membership already saved; the email is a bonus.
    }
  }

  async function toggleJoin(club) {
    setBusyId(club.id);
    setNotice('');
    const joined = joinedIds.has(club.id);
    const { error } = joined
      ? await supabase.from('club_memberships').delete().eq('user_id', userId).eq('club_id', club.id)
      : await supabase.from('club_memberships').insert({ user_id: userId, club_id: club.id });
    setBusyId(null);
    if (error) { setErr(error.message); return; }

    setJoinedIds(prev => {
      const next = new Set(prev);
      joined ? next.delete(club.id) : next.add(club.id);
      return next;
    });

    if (!joined) {
      notifyJoin(club);
      setNotice(CLUB_JOIN_WEBHOOK
        ? `You're in ${club.name}. A confirmation email is on its way.`
        : `You're in ${club.name}.`);
    }
  }

  return (
    <>
      <div className="annot">Clubs</div>

      {err && <div className="notice err">{err}</div>}
      {notice && <div className="notice ok">{notice}</div>}

      {!profile?.full_name && (
        <div className="notice">
          Fill in your name on the Profile tab first — it's used on club
          confirmation emails.
        </div>
      )}

      {clubs.length === 0 && !err && (
        <div className="empty">
          <div className="k"><UsersIcon size={14} /> No clubs listed yet</div>
          <p>Clubs posted by GUtech will show up here — check back soon.</p>
        </div>
      )}

      <div className="clubs-grid">
        {clubs.map(club => {
          const meta = metaFor(club.category);
          const { Icon } = meta;
          const joined = joinedIds.has(club.id);
          return (
            <div key={club.id} className={`club-card ${meta.anim}`}>
              <span className={`club-card-icon ${meta.tint}`}>
                <Icon size={24} />
              </span>
              <h3 className="club-card-title">{club.name}</h3>
              <span className="club-card-category">{meta.label}</span>
              <p className="club-card-desc">{club.description}</p>
              <button
                type="button"
                className={`club-join-btn ${joined ? 'is-joined' : ''}`}
                onClick={() => toggleJoin(club)}
                disabled={busyId === club.id}
              >
                {joined ? <><CheckIcon size={13} /> Joined</> : 'Join'}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
