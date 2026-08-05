import { useEffect, useRef, useState } from 'react';
import { supabase, CLUB_JOIN_WEBHOOK } from '../supabase';
import { TrophyIcon, CodeIcon, PaletteIcon, MusicIcon, BriefcaseIcon, GlobeIcon, BookIcon, HeartIcon, UsersIcon, CheckIcon, IdCardIcon, ChevronRight } from './Icons';

// Each category gets its own icon, badge tint, watermark color, and a
// distinct one-shot "reveal" animation played the moment its panel
// scrolls into view — a bounce for sport, a glitch for tech, a spin for
// culture, and so on. See the .reveal-* keyframes in styles.css.
const CATEGORY_META = {
  sport: { label: 'Sport', Icon: TrophyIcon, anim: 'anim-sport', tint: 'tint-success', color: 'var(--accent-success)' },
  tech: { label: 'Tech', Icon: CodeIcon, anim: 'anim-tech', tint: 'tint-blue', color: 'var(--gu-blue)' },
  arts: { label: 'Arts', Icon: PaletteIcon, anim: 'anim-arts', tint: 'tint-purple', color: 'var(--cat-academic)' },
  music: { label: 'Music', Icon: MusicIcon, anim: 'anim-music', tint: 'tint-lightblue', color: 'var(--gu-light-blue)' },
  business: { label: 'Business', Icon: BriefcaseIcon, anim: 'anim-business', tint: 'tint-amber', color: 'var(--accent-amber)' },
  culture: { label: 'Culture', Icon: GlobeIcon, anim: 'anim-culture', tint: 'tint-success', color: 'var(--accent-success)' },
  academic: { label: 'Academic', Icon: BookIcon, anim: 'anim-academic', tint: 'tint-bluedark', color: 'var(--gu-blue-dark)' },
  volunteering: { label: 'Volunteering', Icon: HeartIcon, anim: 'anim-volunteering', tint: 'tint-alert', color: 'var(--accent-alert)' },
  general: { label: 'Club', Icon: UsersIcon, anim: 'anim-general', tint: 'tint-blue', color: 'var(--gu-blue)' },
};

function metaFor(category) {
  return CATEGORY_META[category] || CATEGORY_META.general;
}

export default function Clubs({ userId, email, onNavigate }) {
  const [clubs, setClubs] = useState([]);
  const [joinedIds, setJoinedIds] = useState(new Set());
  const [profile, setProfile] = useState(null);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState('');
  const [revealedIds, setRevealedIds] = useState(new Set());
  const [activeId, setActiveId] = useState(null);

  const panelRefs = useRef(new Map());
  const bgIconRefs = useRef(new Map());

  useEffect(() => { load(); }, []);

  // Reveal-on-scroll: each panel plays its entrance animation the first
  // time it crosses into view, then stays revealed (no re-triggering on
  // scroll-back, which would feel gimmicky rather than dramatic).
  useEffect(() => {
    if (clubs.length === 0) return;
    const root = document.querySelector('main');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const id = entry.target.dataset.clubId;
        if (entry.isIntersecting) {
          setRevealedIds(prev => (prev.has(id) ? prev : new Set(prev).add(id)));
        }
        if (entry.intersectionRatio > 0.55) setActiveId(id);
      });
    }, { root, threshold: [0, 0.25, 0.55, 0.8] });

    panelRefs.current.forEach(el => el && observer.observe(el));
    return () => observer.disconnect();
  }, [clubs]);

  // Ambient parallax on each panel's giant background watermark icon —
  // purely decorative, tied to scroll position, rAF-throttled. Skipped
  // entirely under reduced-motion.
  useEffect(() => {
    if (clubs.length === 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const root = document.querySelector('main');
    if (!root) return;
    let raf = null;
    function tick() {
      raf = null;
      const vh = window.innerHeight;
      panelRefs.current.forEach((el, id) => {
        const bg = bgIconRefs.current.get(id);
        if (!el || !bg) return;
        const rect = el.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const progress = Math.max(-0.6, Math.min(0.6, (vh / 2 - center) / vh));
        bg.style.transform = `translate(-50%, calc(-50% + ${progress * 70}px)) scale(${1 + Math.abs(progress) * 0.1})`;
      });
    }
    function onScroll() { if (!raf) raf = requestAnimationFrame(tick); }
    root.addEventListener('scroll', onScroll, { passive: true });
    tick();
    return () => root.removeEventListener('scroll', onScroll);
  }, [clubs]);

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

  // A club roster is only useful if it actually has the student's details —
  // require name, student ID and program before Join does anything.
  const profileComplete = !!(profile?.full_name?.trim() && profile?.student_id?.trim() && profile?.program?.trim());

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
          full_name: profile.full_name,
          student_id: profile.student_id,
          program: profile.program,
          club_name: club.name,
          club_category: club.category,
        }),
      });
    } catch {
      // Silent — the membership already saved; the email is a bonus.
    }
  }

  async function toggleJoin(club) {
    if (!profileComplete) return;
    setBusyId(club.id);
    setNotice('');
    const joined = joinedIds.has(club.id);
    const { error } = joined
      ? await supabase.from('club_memberships').delete().eq('user_id', userId).eq('club_id', club.id)
      // Snapshot the student's profile onto the membership row itself —
      // one table, filterable per club_id, no per-club table sprawl needed
      // to answer "who's in Robotics Club and what's their student ID".
      : await supabase.from('club_memberships').insert({
          user_id: userId,
          club_id: club.id,
          full_name: profile.full_name,
          student_id: profile.student_id,
          program: profile.program,
        });
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

  function scrollToClub(id) {
    panelRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <>
      <div className="annot">Clubs</div>

      {err && <div className="notice err">{err}</div>}
      {notice && <div className="notice ok">{notice}</div>}

      {!profileComplete && (
        <div className="notice err profile-gate">
          <div>
            <strong>Finish your profile to join a club.</strong>
            <p style={{ margin: '4px 0 0' }}>
              Your name, student ID and program are needed — clubs use them to know who's a member.
            </p>
          </div>
          <button type="button" className="ghost" onClick={() => onNavigate?.('profile')}>
            <IdCardIcon size={14} /> Complete profile
          </button>
        </div>
      )}

      {clubs.length === 0 && !err && (
        <div className="empty">
          <div className="k"><UsersIcon size={14} /> No clubs listed yet</div>
          <p>Clubs posted by GUtech will show up here — check back soon.</p>
        </div>
      )}

      {clubs.length > 0 && (
        <>
          <div className="club-scroll-intro">
            <h2>Find your community</h2>
            <p>Scroll to explore every club — tap Join whenever one feels right.</p>
            <span className="club-scroll-cue"><ChevronRight size={16} /></span>
          </div>

          <div className="club-scroll-layout">
            <div className="club-scroll">
              {clubs.map(club => {
                const meta = metaFor(club.category);
                const { Icon } = meta;
                const joined = joinedIds.has(club.id);
                const revealed = revealedIds.has(club.id);
                return (
                  <div
                    key={club.id}
                    data-club-id={club.id}
                    ref={el => { if (el) panelRefs.current.set(club.id, el); else panelRefs.current.delete(club.id); }}
                    className={`club-panel ${meta.anim} ${revealed ? 'in-view' : ''}`}
                  >
                    <span
                      className="club-panel-bg-icon"
                      style={{ color: meta.color }}
                      ref={el => { if (el) bgIconRefs.current.set(club.id, el); else bgIconRefs.current.delete(club.id); }}
                    >
                      <Icon size={220} />
                    </span>

                    <div className="club-panel-content">
                      <span className={`club-panel-icon ${meta.tint}`}>
                        <Icon size={30} />
                      </span>
                      <span className="club-panel-category">{meta.label}</span>
                      <h3 className="club-panel-title">{club.name}</h3>
                      <p className="club-panel-desc">{club.description}</p>
                      <button
                        type="button"
                        className={`club-join-btn ${joined ? 'is-joined' : ''}`}
                        onClick={() => toggleJoin(club)}
                        disabled={busyId === club.id || (!profileComplete && !joined)}
                        title={!profileComplete && !joined ? 'Complete your profile first' : undefined}
                      >
                        {joined ? <><CheckIcon size={14} /> Joined</> : 'Join'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="club-rail">
              {clubs.map(club => (
                <button
                  key={club.id}
                  type="button"
                  className={`club-rail-dot ${activeId === club.id ? 'is-active' : ''}`}
                  onClick={() => scrollToClub(club.id)}
                  aria-label={`Jump to ${club.name}`}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
