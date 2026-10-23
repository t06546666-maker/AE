# Staff approval emails

After a successful, non-replayed Account Head approval, the backend sends an AE-branded email to the claim owner's Supabase Auth email. No browser-supplied recipient is used. Expense claims and money requests are supported; other review actions do not send this email. Existing Firebase notifications remain unchanged.

Configure the server with `RESEND_API_KEY` and `EXPENSE_FROM_EMAIL=info@affiliateinnovations.co.in`. Verify the sender domain in Resend before enabling live delivery. Do not change domain MX records merely to enable outbound transactional mail. The logo is the existing public `/logo.png` asset.

Approval commits before email delivery. Email failure does not undo approval; the API returns `approval_email: failed` and logs a non-sensitive warning. Provider acceptance returns `sent`, which is not proof of inbox delivery. Monitor Resend delivery/bounce events. RPC replays skip email, and a stable claim/version idempotency key protects provider retries within the provider's retention window. There is no durable outbox or automatic retry in this implementation; failed emails need operational follow-up. Never re-approve a claim to resend email.

Run `node tests/expense-email.cjs` and `node tests/expenses-api.cjs`. No real email is sent by these tests.
