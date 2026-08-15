-- Cover photos for clubs that already existed, pulled from each club's
-- own event/promo material.
update clubs set image_url = 'https://qwtfrfnwhufsnpczfypb.supabase.co/storage/v1/object/public/club-images/ageo.jpg'
  where name = 'AGEO Club';
update clubs set image_url = 'https://qwtfrfnwhufsnpczfypb.supabase.co/storage/v1/object/public/club-images/cs.jpg'
  where name = 'Computer Science Club';
update clubs set image_url = 'https://qwtfrfnwhufsnpczfypb.supabase.co/storage/v1/object/public/club-images/sport.jpg'
  where name = 'Sports Club';

-- Two clubs whose photos we had but that weren't in the roster yet.
insert into clubs (name, category, description, contact_email, image_url) values
  ('Music Club', 'music', 'GUtech''s student music club — performances, sound and campus events.', 'music.club@gutech.edu.om', 'https://qwtfrfnwhufsnpczfypb.supabase.co/storage/v1/object/public/club-images/music.jpg'),
  ('Engineering Club', 'tech', 'GUtech''s student engineering club — 3D printing, builds and hands-on projects.', 'engineering.club@gutech.edu.om', 'https://qwtfrfnwhufsnpczfypb.supabase.co/storage/v1/object/public/club-images/eng.jpg')
on conflict do nothing;
