# RewardHub

RewardHub is a Node.js/Express customer rewards application with Supabase
authentication and storage, merchant QR checkout, date-filtered reporting,
Meta WhatsApp Cloud API notifications, and optional Resend email.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and add the required credentials.
3. Run `supabase-schema.sql`, `supabase-reward-settings.sql`,
   `supabase-dashboard-whatsapp.sql`, `supabase-universal-qr.sql`, and
   `supabase-per-purchase-rewards.sql` in the Supabase SQL Editor.
4. Start the app with `npm start`.
5. Open `http://localhost:3000`.

## Production

Set all environment variables in Vercel or your Node hosting provider. Do not
commit `.env`. Camera scanning requires HTTPS in production.

Configure the Meta webhook URL as:

`https://YOUR_DOMAIN/api/webhooks/whatsapp`

The registration and reward WhatsApp templates must be approved in WhatsApp
Manager and their body parameters must match the order documented in
`.env.example`.

## Roles

- Admins can view all merchants, customers, reports, reward settings, and
  administrator accounts.
- Merchants can access only their own customers, orders, analytics, and QR
  scanner.
