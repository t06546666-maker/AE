-- Ad banners table for admin promotional banner management
create table if not exists public.ad_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  image_path text not null,
  placement text not null default 'top', -- 'top' (home carousel), 'downside' (lower feed banner), 'explore' (explore page)
  link_type text not null default 'explore', -- 'explore', 'merchant', 'offer', 'external'
  link_value text,
  active boolean not null default true,
  display_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for fast customer queries
create index if not exists idx_ad_banners_placement_active on public.ad_banners(placement, active, display_order);
