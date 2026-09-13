
-- Create merchant_categories table
CREATE TABLE IF NOT EXISTS public.merchant_categories (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    created_at timestamptz not null default now()
);

-- Add category_id to merchants table (nullable, so it's optional)
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS category_id uuid references public.merchant_categories(id) on delete set null;

-- Index for performance
CREATE INDEX IF NOT EXISTS merchants_category_idx on public.merchants(category_id);
