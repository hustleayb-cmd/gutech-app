-- Clear the temporary test address now that Mail.Send is confirmed
-- working end-to-end. Populate real per-club contact emails whenever
-- ready — the app already reads clubs.contact_email live.
update clubs set contact_email = '' where name = 'Community Outreach';
