# Staff approval emails

## Titan SMTP (preferred when configured)

Set server-only environment variables: `EXPENSE_EMAIL_PROVIDER=titan`, `TITAN_SMTP_USER=info@affiliateinnovations.co.in`, `TITAN_SMTP_PASSWORD` (enter securely in hosting settings), and optionally `TITAN_SMTP_PORT=465` (SSL/TLS) or `587` (mandatory STARTTLS). Never use VITE-prefixed variables for credentials. Host is fixed to `smtp.titan.email` with certificate verification enabled. Existing Resend configuration is preserved for other app emails. No DNS/MX changes are required by this implementation.

The sender display name is AE Accounts — No Reply. This is a notice, not a mechanism to block inbound replies. Titan SMTP does not provide provider idempotency: database replay suppression remains, but a stable Message-ID is not a guarantee of duplicate prevention or inbox delivery. Failed sends are not retried automatically. Do not re-approve to resend. Titan third-party app access must be enabled by the mailbox owner if required; do not disable security protections automatically.

After a successful, non-replayed Account Head approval, the backend sends an AE-branded email to the claim owner's Supabase Auth email. No browser-supplied recipient is used. Expense claims and money requests are supported; other review actions do not send this email. Existing Firebase notifications remain unchanged.

Configure the server with `RESEND_API_KEY` and `EXPENSE_FROM_EMAIL=info@affiliateinnovations.co.in`. Verify the sender domain in Resend before enabling live delivery. Do not change domain MX records merely to enable outbound transactional mail. The logo is the existing public `/logo.png` asset.

Approval commits before email delivery. Email failure does not undo approval; the API returns `approval_email: failed` and logs a non-sensitive warning. Provider acceptance returns `sent`, which is not proof of inbox delivery. Monitor Resend delivery/bounce events. RPC replays skip email, and a stable claim/version idempotency key protects provider retries within the provider's retention window. There is no durable outbox or automatic retry in this implementation; failed emails need operational follow-up. Never re-approve a claim to resend email.

Run `node tests/expense-email.cjs` and `node tests/expenses-api.cjs`. No real email is sent by these tests.
