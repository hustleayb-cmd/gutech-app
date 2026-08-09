-- Each club gets its own contact email — the "join club" flow emails this
-- address (via the student's connected Outlook account) instead of just
-- recording a membership row. Populate real addresses per club yourself;
-- until then the app falls back to the old n8n-webhook confirmation flow.
alter table clubs add column if not exists contact_email text not null default '';
