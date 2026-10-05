-- Existing duplicate active visits must be reviewed and completed before applying.
-- No historical records are deleted or modified by this migration.
create unique index if not exists field_manager_one_active_visit
on public.field_manager_visits(manager_id) where status = 'active';
