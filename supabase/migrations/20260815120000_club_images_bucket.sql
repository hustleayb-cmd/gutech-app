-- Public storage bucket for club cover photos (More → Clubs). Public
-- because these are the same photos clubs already post on their own
-- social pages — no student data involved, just event/promo imagery.
insert into storage.buckets (id, name, public)
values ('club-images', 'club-images', true)
on conflict (id) do nothing;

drop policy if exists "club images public read" on storage.objects;
create policy "club images public read" on storage.objects
  for select using (bucket_id = 'club-images');

-- club cover image, shown as the panel's hero photo instead of the
-- generic category watermark icon once a club has one
alter table clubs add column if not exists image_url text;
