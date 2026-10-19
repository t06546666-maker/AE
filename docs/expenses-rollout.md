# Staff expenses rollout

The source implementation is not a production migration or publication.

## Deployment order

1. Review and back up the production schema. Apply `supabase-expenses.sql` with approved database-owner access. It is additive for expenses; existing rewards and attendance records are not changed.
2. Verify the private `expense-receipts` bucket and server-only table/function grants. The restrictive storage policy denies direct client access to this bucket, including where existing permissive policies exist.
3. Deploy backend and frontend together only after the schema is installed. Existing Supabase server credentials and Firebase notification credentials are reused; never put service keys in frontend variables.
4. Admin creates separate staff and Account Head test accounts at `/expense-staff`. Temporary passwords must be changed. Existing Field Managers keep their credentials.
5. Verify `/expenses` with an employee and `/accounts` with a different Account Head. Check receipts, corrections, approval and payment recording before broad use. Verify admin is denied both finance routes.
6. If shipping bundled Android assets, build a new signed bundle through the established Android release process after these checks. This feature does not itself publish a Play release.

## Verification

- `npm run check`
- `npm run build`
- `node tests/expenses-sql.cjs` (isolated embedded PostgreSQL; no production access)
- `node tests/expenses-api.cjs` (local HTTP fixtures; no production access)
- `node tests/localization/packs.cjs`

`node tests/expenses-preview.cjs` serves the built UI with clearly marked local test data on port 3000. It is not a payment or production backend.

## Operational behavior

Accounts has Requests (submitted, corrections, rejected), Pending payments (approved), and Payment history (paid). History date filters use payment dates; other lists use expense dates. Monthly summaries use expense month and current status, optionally filtered by employee/department. Approved includes paid; outstanding is approved but unpaid, not a historical bank balance.

Filtered Excel downloads include payment method/date/reference/note. Print / Save PDF opens the browser print workflow with text-safe localized report content. Exports and summary scans are bounded to 5,000 matching rows; larger reports ask users to narrow filters rather than silently truncate. Report and summary APIs remain Account Head-only.

Payment recording stores an externally completed payment; it never transfers or verifies money. Money uses integer paise. Claim transitions use transactions, version checks and request idempotency. Receipts are validated and downloaded using 60-second signed links after server authorization. Audit snapshots preserve each transition.

Firebase notifications are attempted after a successful transaction using the existing notification service. Notification delivery failures do not reverse saved financial records; the dashboard remains the source of truth. No WhatsApp messages are sent.

Production migration, real account creation, deployment and publication remain separate execution steps requiring approval. A production end-to-end test with real Firebase credentials is still required after deployment.
