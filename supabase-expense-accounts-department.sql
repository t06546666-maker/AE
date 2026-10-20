-- Extend the existing department dropdown. No role changes or account reassignment.
begin;
alter table public.expense_members drop constraint if exists expense_members_department_check;
alter table public.expense_members add constraint expense_members_department_check
 check (department in ('Accounts','Developer','Field Manager','HR','Marketing','Other'));
commit;
