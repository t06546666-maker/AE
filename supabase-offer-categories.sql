-- Add merchant offer categories for catalogue filtering.
alter table public.offers add column if not exists category text;
create index if not exists offers_category_idx on public.offers(category);
