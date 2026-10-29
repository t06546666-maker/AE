# Isolated AE staging

Status: safety checks and launcher prepared. Cloud projects/schema/accounts and HTTP load testing are not yet completed.

## Setup progress — 21 October 2026

Separate owner account verified: safar@affiliateinnovations.co.in. Supabase Free organization `nsmedsqjkhqysamqyaco`, project **AE Staging**, reference `gcojiipcmwzpvmlixqsk` (Tokyo). Project creation was completed by the owner; project naming was verified in the dashboard. Schema and synthetic accounts are still pending.

Firebase **AE Staging** (`ae-staging-51cc9`) was created under the same company email on Spark after explicit owner approval of Firebase terms. Admin private-key generation is awaiting action-time approval; app registration, Auth and Firestore configuration remain pending. Optional Developer Programme enrollment was disabled. k6 2.2.0 is available as an official portable build at `C:/Users/91730/Downloads/ae-k6-tools/k6-v2.2.0-windows-amd64/k6.exe`; the stalled Windows installer was cancelled. `k6 inspect` successfully validated `tests/load/staging-smoke.js`, which has not run against staging. It defaults to one virtual user for 20 seconds and checks the real customer-category API; it rejects any server without the exact staging identity. This initial test cannot establish checkout correctness, notification delivery, Android crashes or capacity at thousands of concurrent users.

After the dedicated services and schema are configured, run `k6 run tests/load/staging-smoke.js` from a private output directory to capture `k6-staging-summary.json`. Review this baseline before explicitly choosing a higher load. Health identity alone is not a database availability test; the categories check must also pass.

## Separate services (free plans only)

1. Create **AE Staging** in Supabase, distinct from the live project. The account owner must enter its database password. Stop if a paid plan is required.
2. Create a separate Firebase project whose ID contains `staging`, on Spark. Do not copy production Firebase Admin credentials. Firebase project creation/terms and credential provisioning may require owner action.
3. Create a separate Vercel project, with deployment protection, only if the account and intended usage qualify for its free plan. Do not repoint the production domain or change its environment settings. Do not assume preview deployments isolate a database.
4. Install reviewed schema-only migrations in the new database. Do not import customer data, passwords, tokens, phone numbers, production Vault secrets, cron jobs or webhooks. The old load-test seed SQL is not a full application environment: it does not create auth identities or transactions.
5. Provision synthetic customer and merchant identities and verify RLS, API roles and duplicate-write behavior before increasing traffic.

## Local launcher for those dedicated cloud projects

Copy `staging.env.example` to `.env.staging`, fill all values from the NEW projects, generate a separate random customer JWT secret, then run:

```
node scripts/staging.cjs check
node scripts/staging.cjs build
node scripts/staging.cjs start
```

The local staging UI/API use port 3020 and `dist-staging/`. Production `.env` is not loaded by the launcher. Environment values inherited from the caller are discarded except operating-system essentials. Staging rejects the known production Supabase references and Firebase project, project/key mismatches, production API destinations, messaging/payment credentials and enabled push sends. Firebase Admin uses environment credentials only, never the local production service-account file.

For Vercel, set AE_ENV=staging and VITE_AE_ENV=staging plus the dedicated values in the separate project. Configure its build command for `vite build --mode staging --configLoader runner`, output directory `dist-staging`, and API function includeFiles `dist-staging/**`. Never change the live project's vercel.json to achieve this.

Do not use the production Android package/signing identity for a staging app. A separate Android applicationId and Firebase Android app must be configured before phone tests. Web staging alone does not establish Play-installed OTP correctness.

## Outbound services

WhatsApp, email, payment-provider credentials and real push delivery remain disabled. Staging Firestore inbox logic may be tested in the dedicated project. Actual notification delivery is a later, separately approved test restricted to named test devices. No real SMS, WhatsApp recipients or money transfers are needed for baseline capacity testing.

## Load testing gate

No high-volume traffic until isolation, schema, test logins, ledger reconciliation, backups/reset and free-tier usage limits have been checked. A free database may not represent production capacity and 50,000 concurrent sessions are not a reasonable first run.

Start with 10 active users, then 50 and 100 under an agreed request rate. Distinguish total synthetic accounts from concurrency. Capture p50/p95/p99, error rate, throughput, DB connections and provider resource metrics. Stop on errors or quota pressure before ramping. Never substitute local mock/in-process timing for staging backend results.

## Existing security concern

The tracked legacy `.env.example` appears to contain a service-role credential rather than only placeholders. Treat it as potentially exposed: the owner should rotate it in Supabase and remove it from tracked examples/history as appropriate. Do not reuse it for staging. Rotation is not performed by this setup.
