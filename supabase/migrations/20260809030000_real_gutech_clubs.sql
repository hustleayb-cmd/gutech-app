-- Swap the placeholder demo clubs for the real GUtech club roster, with
-- each one's actual contact email wired in for the "Join" automation.
delete from clubs;

insert into clubs (name, category, description, contact_email) values
  ('Sports Club', 'sport', 'GUtech''s student sports club — matches, training and campus fitness.', 'sports.club@gutech.edu.om'),
  ('AGEO Club', 'academic', 'GUtech''s AGEO student club.', 'AGEO.Club@gutech.edu.om'),
  ('Computer Science Club', 'tech', 'GUtech''s student club for Computer Science.', 'ComputerScience.Club@gutech.edu.om'),
  ('UPAD Club', 'academic', 'GUtech''s UPAD student club.', 'upad.club@gutech.edu.om'),
  ('Theatre Club', 'arts', 'GUtech''s student theatre and drama club.', 'Theatre.Club@gutech.edu.om'),
  ('Event Management Club', 'business', 'GUtech''s student club for event planning and management.', 'eventmanagement.club@gutech.edu.om'),
  ('Logistics Club', 'business', 'GUtech''s student club for logistics and supply chain.', 'logistics.club@gutech.edu.om'),
  ('Entrepreneurship Club', 'business', 'GUtech''s student club for entrepreneurship and startups.', 'business.club@gutech.edu.om');
