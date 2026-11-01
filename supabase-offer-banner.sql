-- Adds optional dedicated banner image path to offers table
alter table public.offers add column if not exists banner_image_path text;
