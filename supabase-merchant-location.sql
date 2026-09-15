-- Run once in Supabase Dashboard > SQL Editor for the merchant form fields.
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

CREATE INDEX IF NOT EXISTS merchants_location_idx
  ON public.merchants(latitude, longitude);
