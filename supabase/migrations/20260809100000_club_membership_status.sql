-- Tracks the join request's real-world state, driven by an n8n automation
-- watching for the club's acceptance email — the app only ever sets it to
-- 'pending' on join; n8n (using its own service-role credential, never
-- exposed to the browser) flips it to 'accepted' once the club replies.
alter table club_memberships add column if not exists status text not null default 'pending';
-- pending | accepted | declined

create index if not exists idx_memberships_status on club_memberships(status);
