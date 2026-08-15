-- Cover photos for three more clubs, pulled from their own event material.
update clubs set image_url = 'https://qwtfrfnwhufsnpczfypb.supabase.co/storage/v1/object/public/club-images/theatre.jpg'
  where name = 'Theatre Club';
update clubs set image_url = 'https://qwtfrfnwhufsnpczfypb.supabase.co/storage/v1/object/public/club-images/event.jpg'
  where name = 'Event Management Club';
update clubs set image_url = 'https://qwtfrfnwhufsnpczfypb.supabase.co/storage/v1/object/public/club-images/enterprise.jpg'
  where name = 'Entrepreneurship Club';
