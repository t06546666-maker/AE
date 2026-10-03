# Customer notifications through Firebase

Customer phone -> authenticated AE preferences API -> Firestore token registry.
Merchant transaction -> AE backend -> Firestore lookup -> FCM -> customer phone.

Purchases, identity authentication, points and other preferences still use
Supabase. Customer notification-token storage and lookup do not. Merchant/admin
push tokens are unchanged. This does not fix a device failing to generate a token.

## Required before deployment

1. In Firebase project `ae2026-27134`, create Cloud Firestore's default database
   in production mode if it does not already exist. Review the region and costs.
2. Ensure the backend's Firebase service account can read/write Firestore and
   send FCM messages. Keep `FIREBASE_SERVICE_ACCOUNT_JSON` on the server only.
3. Deny client access to the `ae_customer_notifications` collection. Add this
   block to the project's existing Firestore rules; do not replace unrelated rules:

   ```
   match /ae_customer_notifications/{document=**} {
     allow read, write: if false;
   }
   ```

   Check for any broader rules that allow access: an overlapping allow rule
   overrides this denial. The Admin SDK uses server IAM, not client rules.
4. Deploy the backend, open the Android app, sign in as the customer and allow
   notifications. Existing Supabase tokens are not automatically migrated.
5. Confirm Firestore has `ae_customer_notifications/<authenticated customer ID>`
   with `push_token`, `push_enabled` and `updated_at`. Do not share token values.
6. Send an authenticated `POST /api/customer/notifications/test`, then perform a
   merchant transaction. Verify the matching customer's notification tray.

Only the latest registered phone per customer is retained, matching the previous
single-token behavior. Disabling push updates Firestore. No customer names, phone
numbers, purchase details or balances are copied into this registry.

An FCM send accepted by Firebase does not prove the phone displayed it. Check OS
notification permission, channel settings and connectivity separately. The local
app-open welcome is independent and is not an FCM delivery test.

Run `node scripts/check-customer-push.cjs` for mocked registry/routing checks.
Live Firestore setup, registration and end-to-end delivery require separate tests.
