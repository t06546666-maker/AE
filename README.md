# RewardHub

RewardHub is a React, Vite, TypeScript, and Express customer rewards application
with Supabase authentication and storage, merchant QR checkout, date-filtered
reporting, Meta WhatsApp Cloud API notifications, and optional Resend email.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and add the required credentials.
3. For a new Supabase project, create the first Auth user and run
   `supabase-fresh-install.sql` in the Supabase SQL Editor. Existing databases
   should run `supabase-react-performance.sql` and any later targeted migration,
   including `supabase-short-order-numbers.sql` and
   `supabase-offers-merchant-security.sql`.
4. Build the React application with `npm run build`.
5. Start Express with `npm start` and open `http://localhost:3000`.

For frontend development, run Express on port 3000 and `npm run dev` for the
Vite development server. Vite proxies `/api` requests to Express.

## Production

Set all environment variables in Vercel or your Node hosting provider. The
included `vercel.json` builds React and routes the application through the
Express serverless entry. Do not commit `.env`. Camera scanning requires HTTPS
in production.

Configure the Meta webhook URL as:

`https://YOUR_DOMAIN/api/webhooks/whatsapp`

The registration, reward, merchant account-ready, and offer WhatsApp templates
must be approved in WhatsApp Manager, and their body parameters must match the
order documented in `.env.example`.

The offer broadcast uses a Supabase Cron worker so campaigns continue after the
admin closes the browser:

1. Add `OFFER_QUEUE_SECRET` to Vercel.
2. In Supabase Vault, create `offer_queue_url` with the production origin and
   `offer_queue_secret` with the same secret.
3. Enable `pg_cron` and `pg_net`.
4. Run the commented `cron.schedule` block at the bottom of
   `supabase-offers-merchant-security.sql`.

Merchant account-ready messages are Utility templates and do not contain a
password. The one-time temporary password appears only in the authenticated
admin response. Offer broadcasts are Marketing templates with a dynamic image
header.

## Roles

- Admins can view all merchants, customers, reports, reward settings, and
  administrator accounts. Admins approve, reject, and send merchant offers.
- Merchants can access only their own customers, orders, analytics, and QR
  scanner. New and reset merchant accounts must replace their temporary
  password before the rest of the workspace is available.
