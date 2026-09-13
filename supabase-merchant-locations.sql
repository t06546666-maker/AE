-- Run this in Supabase SQL Editor before using the Nearby map.
alter table public.merchants add column if not exists address text;
alter table public.merchants add column if not exists latitude double precision;
alter table public.merchants add column if not exists longitude double precision;

alter table public.merchants drop constraint if exists merchants_coordinates_valid;
alter table public.merchants add constraint merchants_coordinates_valid check (
  (latitude is null and longitude is null) or
  (latitude between -90 and 90 and longitude between -180 and 180)
);
