ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS push_token text,
ADD COLUMN IF NOT EXISTS push_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS location_enabled boolean DEFAULT false;
