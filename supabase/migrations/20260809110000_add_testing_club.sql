-- Adds a test club for exercising the join-request/draft-email flow end to
-- end without touching the real GUtech club roster.
insert into clubs (name, category, description, contact_email) values
  ('Testing Club', 'general', 'Internal test club used to verify the join flow.', 'hustle.ayb@outlook.com');
