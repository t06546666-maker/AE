# Money requests

Employees can choose Expense claim (already incurred expenses) or Request money (funds needed by a chosen date). Both use existing staff authentication, Account Head-only review, audit, correction and external payment recording. Admin finance access is not expanded. No additional conditions, salary, commission, repayment logic or automatic transfers are introduced.

Requests have amount, category, reason, a database-assigned current IST request date and a required money-needed-by date no earlier than the request date. Receipts remain optional. Request dates remain stable on draft edits. The chosen date is a request, not a promise of payment.

Before enabling this on a deployed backend, apply **supabase-expense-money-requests.sql** after the existing expense migrations. Existing records default to expense claims; no points, balances or attendance tables are changed. The migration is repeatable. It wraps the existing expense_action RPC with date metadata validation while preserving its transaction, locks, permissions and replay handling. If the original v1 migration is reinstalled later, reinstall this additive migration afterwards. The internal base RPC is revoked from service_role and client roles, leaving only the validated wrapper callable by the backend.

Deploy schema first, then API and frontend together. Production migration has NOT been executed by this local change. Verify separate employee/Account Head accounts and test a request through corrections, approval and external payment recording before rollout. Requested dates appear in detail views, list rows and Excel exports.
