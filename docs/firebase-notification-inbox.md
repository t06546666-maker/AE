# Firebase notification inbox

Merchant, admin and Field Manager app-inbox events now use Firestore through the AE backend. The optional `supabase-app-notifications.sql` file is historical and is **not required or applied** for this implementation.

- Collection path: `ae_profile_notification_inboxes/{authenticatedProfileId}/items/{notificationId}`.
- The backend derives the profile ID from its verified AE session, never from caller-supplied profile IDs.
- Firestore client rules remain deny-all. Only Firebase Admin on the backend reads/writes these records; no client rules or permissions were widened.
- The API response shape remains compatible with the v38 Android app. No new Android bundle is required solely for this backend storage change.
- IDs use the `firebase:` prefix. Mark-read checks the notification inside the authenticated profile's subcollection and returns 404 for another user's notification.
- A single-field ordered query loads the latest page; a separate aggregate query counts all unread inbox items. No custom composite index is required by these queries.
- A failed inbox save does not suppress the independent FCM push. Inbox read errors return 503 rather than pretending the inbox is empty.
- Existing historical merchant notifications are still displayed from their original store. Points, transactions, account records and merchant token lookup are unchanged in Supabase. Customer push-token lookup, checkout bills and sales-target events retain their existing Firebase paths.

Verification: `node tests/firestore-notification-inbox.cjs`, `npm run check`, and existing customer-push/onboarding/checkout checks. A live isolated temporary Firestore record successfully exercised save, list, unread count, mark-read and profile isolation; the record was then removed. No real-user push or WhatsApp message was sent by this test. Device delivery still needs a Play-installed test.
