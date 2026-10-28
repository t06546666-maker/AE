ALTER TABLE public.field_attendance ADD COLUMN IF NOT EXISTS end_latitude double precision, ADD COLUMN IF NOT EXISTS end_longitude double precision, ADD COLUMN IF NOT EXISTS end_accuracy_m double precision;
NOTIFY pgrst, 'reload schema';
