-- Location remains required for normal attendance. A NULL selfie explicitly
-- identifies attendance recorded without a photo; never substitute a fake image.
begin;
alter table public.field_attendance alter column selfie drop not null;
alter table public.field_attendance drop constraint if exists field_attendance_capture_or_admin;
alter table public.field_attendance add constraint field_attendance_capture_or_admin check (
 (admin_started_by is not null and admin_started_at is not null and length(trim(admin_start_reason))>=5)
 or (latitude is not null and longitude is not null and accuracy_m is not null
     and latitude between -90 and 90 and longitude between -180 and 180
     and accuracy_m >= 0)
);
commit;
