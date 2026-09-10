-- Add password authentication columns to the customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT true;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_reset_at TIMESTAMPTZ;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
