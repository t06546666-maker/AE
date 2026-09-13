
-- Add expires_at to reward_lots
ALTER TABLE public.reward_lots ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Set existing records to expire 1 year from creation
UPDATE public.reward_lots SET expires_at = created_at + interval '1 year' WHERE expires_at IS NULL;

-- Make expires_at NOT NULL and add default for new rows
ALTER TABLE public.reward_lots ALTER COLUMN expires_at SET NOT NULL;
ALTER TABLE public.reward_lots ALTER COLUMN expires_at SET DEFAULT (now() + interval '1 year');

-- Note: No need to alter status check constraint as it doesn't exist or is not strictly enforced in DDL for EXPIRED.
