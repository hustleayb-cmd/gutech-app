-- Temporary live-send test: routes Community Outreach's join emails to
-- the developer's own inbox to confirm Mail.Send works end-to-end before
-- real per-club addresses are populated. Safe to overwrite later with the
-- real address.
update clubs set contact_email = 'ay.baabood@gmail.com' where name = 'Community Outreach';
