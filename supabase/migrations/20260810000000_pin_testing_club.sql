-- Lets a club be pinned to the front of the Clubs list regardless of
-- alphabetical order — used for Testing Club so it's the first panel you
-- see (no scrolling past the real roster) while repeatedly testing the
-- n8n join-status automation.
alter table clubs add column if not exists is_pinned boolean not null default false;

update clubs set is_pinned = true where name = 'Testing Club';
