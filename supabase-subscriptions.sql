-- Add subscription and point balance fields to merchants table
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS point_balance INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_mandate_id TEXT;
