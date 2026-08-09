import { useEffect, useRef, useState } from 'react';
import { supabase, CLUB_JOIN_WEBHOOK } from '../supabase';
import { TrophyIcon, CodeIcon, PaletteIcon, MusicIcon, BriefcaseIcon, GlobeIcon, BookIcon, HeartIcon, UsersIcon, CheckIcon, IdCardIcon, ChevronRight, SyncIcon, TimerIcon } from './Icons';
import { outlookConfigured, getOutlookAccount, whenOutlookReady, connectOutlook, createOutlookDraft } from '../lib/outlook';

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

// On a phone, outlook.live.com/outlook.office.com links are registered as
// universal/app links — the OS hands them to the installed Outlook app
// automatically, but only for a real top-level navigation, not a new
// browser tab (mobile browsers generally don't run that app-link handoff
// for window.open popups). Desktop has no "app" to hand off to, so a new
// tab showing Outlook Web is the right target there instead.
function isMobileDevice() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export default function Clubs({ userId, email, onNavigate }) {
  const [clubs, setClubs] = useState([]);
  // club_id -> { id: membership row id, status: 'pending' | 'accepted' | 'declined' }
  // The status starts 'pending' the moment the app inserts the row, and only
  // ever moves from there via an outside n8n automation watching the
  // student's inbox for the club's reply — the app itself never sets
  // 'accepted'. Realtime keeps this in sync the instant n8n flips it.
  const [memberships, setMemberships] = useState(new Map());
  const [profile, setProfile] = useState(null);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState('');
  const [revealedIds, setRevealedIds] = useState(new Set());
  const [activeId, setActiveId] = useState(null);
  const [outlookAccount, setOutlookAccount] = useState(() => getOutlookAccount());
  const [connecting, setConnecting] = useState(false);

  const panelRefs = useRef(new Map());
  const bgIconRefs = useRef(new Map());

  useEffect(() => { load(); }, []);

  // Live status updates — when n8n's automation detects the club's
  // acceptance email and PATCHes this student's membership row, this
  // subscription pushes the change straight into the UI, no refresh needed.
  useEffect(() => {
    const channel = supabase
      .channel(`club-memberships-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'club_memberships', filter: `user_id=eq.${userId}` }, payload => {
        setMemberships(prev => {
          const next = new Map(prev);
          if (payload.eventType === 'DELETE') {
            next.delete(payload.old.club_id);
          } else {
            next.set(payload.new.club_id, { id: payload.new.id, status: payload.new.status });
          }
          return next;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // Same redirect-completion timing as Calendar — the "am I connected"
  // answer isn't final until MSAL has processed a possible redirect
  // response after this remount.
  useEffect(() => { whenOutlookReady().then(setOutlookAccount); }, []);

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
      supabase.from('club_memberships').select('id, club_id, status').eq('user_id', userId),
      supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
    ]);
    if (c.error) { setErr(c.error.message); return; }
    setClubs(c.data ?? []);
    setMemberships(new Map((m.data ?? []).map(r => [r.club_id, { id: r.id, status: r.status }])));
    setProfile(p.data ?? null);
  }

  // A club roster is only useful if it actually has the student's details —
  // require name, student ID and program before Join does anything.
  const profileComplete = !!(profile?.full_name?.trim() && profile?.student_id?.trim() && profile?.program?.trim());
  // Outlook connection is required too — joining sends the actual request
  // email from the student's own mailbox, so there has to be a mailbox to
  // send it from.
  const outlookReady = !!outlookAccount;
  const canJoin = profileComplete && outlookReady;

  async function handleConnectOutlook() {
    setConnecting(true);
    setErr('');
    try {
      await connectOutlook('clubs'); // navigates away on success
    } catch (e) {
      setErr(e.message || 'Could not sign in to Outlook.');
      setConnecting(false);
    }
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

  // Same template every time, just the club's name/address swapped in.
  // Drafts (never sends) the request in the student's own Outlook Drafts
  // folder, then hands back the webLink so the caller can open it — the
  // student reviews and hits Send themselves, nothing goes out on its own.
  // `refCode` (short slice of the membership row's id) rides along in the
  // signature line so that whatever the club replies to still carries it —
  // that's what n8n matches an acceptance email back to this exact row.
  async function prepareClubJoinDraft(club, refCode) {
    if (!club.contact_email) return { drafted: false, reason: 'no-address' };
    try {
      const firstName = profile.full_name.trim().split(/\s+/)[0] || profile.full_name;
      const webLink = await createOutlookDraft({
        to: club.contact_email,
        subject: `wanna join ${club.name}`,
        body: [
          'Hey,',
          '',
          `Saw ${club.name} and figured I'd sign up — looks like a fun one to be part of. I'm in ${profile.program} (ID: ${profile.student_id}), so let me know what's next, if there's a group chat or something I should hop into.`,
          '',
          firstName,
          email,
          `Ref: ${refCode}`,
        ].join('\n'),
      });
      return { drafted: true, webLink };
    } catch (e) {
      return { drafted: false, reason: e.message };
    }
  }

  async function toggleJoin(club) {
    if (!canJoin) return;
    const membership = memberships.get(club.id);
    const joined = !!membership;
    const mobile = isMobileDevice();

    // Desktop only: open the tab synchronously, in the same tick as this
    // click — same reasoning as the Outlook sign-in redirect, any `await`
    // in front of window.open() is enough for the browser to treat it as
    // an unrequested popup and block it. We navigate this already-open
    // blank tab to the real draft link once we have it (or close it if
    // there's nothing to show). Mobile skips this entirely — it navigates
    // the current page instead, see below.
    const draftTab = !joined && !mobile ? window.open('', '_blank', 'noopener,noreferrer') : null;

    setBusyId(club.id);
    setNotice('');

    if (joined) {
      const { error } = await supabase.from('club_memberships').delete().eq('user_id', userId).eq('club_id', club.id);
      if (error) { draftTab?.close(); setBusyId(null); setErr(error.message); return; }
      setMemberships(prev => { const next = new Map(prev); next.delete(club.id); return next; });
      setBusyId(null);
      return;
    }

    // Snapshot the student's profile onto the membership row itself — one
    // table, filterable per club_id, no per-club table sprawl needed to
    // answer "who's in Robotics Club and what's their student ID". status
    // defaults to 'pending' in the DB; .select().single() hands back the
    // new row's id so we can drop a short reference into the email.
    const { data: inserted, error } = await supabase
      .from('club_memberships')
      .insert({
        user_id: userId,
        club_id: club.id,
        full_name: profile.full_name,
        student_id: profile.student_id,
        program: profile.program,
      })
      .select('id, status')
      .single();

    if (error) { draftTab?.close(); setBusyId(null); setErr(error.message); return; }

    setMemberships(prev => { const next = new Map(prev); next.set(club.id, { id: inserted.id, status: inserted.status }); return next; });

    notifyJoin(club);
    const refCode = inserted.id.slice(0, 8).toUpperCase();
    const result = await prepareClubJoinDraft(club, refCode);
    setBusyId(null);
    if (result.drafted) {
      setNotice(`You're in ${club.name} — waiting on their response. Opening your ready-to-send email in Outlook — review it and hit Send.`);
      if (mobile) {
        // Top-level navigation, not a new tab — this is what lets iOS/
        // Android hand off to the installed Outlook app instead of just
        // opening the mobile browser.
        window.location.href = result.webLink;
      } else if (draftTab) {
        draftTab.location.href = result.webLink;
      } else {
        window.open(result.webLink, '_blank', 'noopener,noreferrer'); // popup was blocked before we could open it — try again, best-effort
      }
    } else {
      draftTab?.close();
      if (result.reason === 'no-address') {
        setNotice(`You're in ${club.name}. (No contact email is set for this club yet, so no draft was prepared.)`);
      } else {
        setNotice(`You're in ${club.name}, but preparing the email draft failed: ${result.reason}`);
      }
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

      {profileComplete && !outlookReady && (
        <div className="notice err profile-gate">
          <div>
            <strong>Connect Outlook to join a club.</strong>
            <p style={{ margin: '4px 0 0' }}>
              Joining prepares a ready-to-send request email in your own Outlook — we need it connected first.
            </p>
          </div>
          <button
            type="button"
            className="ghost"
            onClick={handleConnectOutlook}
            disabled={connecting || !outlookConfigured()}
            title={outlookConfigured() ? undefined : 'Outlook sync is not configured yet'}
          >
            <SyncIcon size={14} /> {connecting ? 'Connecting…' : 'Connect Outlook'}
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
                const membership = memberships.get(club.id);
                const joined = !!membership;
                const status = membership?.status ?? null;
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
                        className={`club-join-btn ${status === 'accepted' ? 'is-joined' : status === 'pending' ? 'is-pending' : status === 'declined' ? 'is-declined' : ''}`}
                        onClick={() => toggleJoin(club)}
                        disabled={busyId === club.id || (!canJoin && !joined)}
                        title={!canJoin && !joined ? (!profileComplete ? 'Complete your profile first' : 'Connect Outlook first') : status === 'declined' ? 'Not accepted — tap to remove and try again' : undefined}
                      >
                        {status === 'accepted' ? <><CheckIcon size={14} /> Accepted</>
                          : status === 'pending' ? <><TimerIcon size={14} /> Waiting for response</>
                          : status === 'declined' ? 'Not accepted'
                          : 'Join'}
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
