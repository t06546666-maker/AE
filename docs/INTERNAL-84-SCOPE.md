# Internal testing 84: merchant UPI settings

Based on Counter Staff 82. Keeps the published customer home layout; excludes experimental customer UI and the deferred update-required gate.

Merchant: More → Merchant Profile → UPI payment settings. Save UPI ID, upload the shop payment QR, and enable payment links. QR images go to existing Google/Firebase Storage; settings and URL are stored in Firestore ae_merchant_payment_settings. Shop ownership comes from the signed-in merchant, never from submitted IDs. Disabled by default.

Customer: on a checkout bill, Pay with UPI opens the selected installed UPI app with the shop UPI ID and discounted bill amount. Uploaded QR is also viewable. Shops without enabled valid settings retain the existing scan-shop-QR flow. Returning from UPI never marks a bill paid. Confirm receipt at the shop. No gateway order creation, payment webhook or settlement integration.

Validation: TypeScript/build, UPI validation and isolation tests, gateway-disabled regression, Counter Staff tests. Physical UPI handoff/payment must be verified by the tester on Android.

Release: versionCode 84, versionName 1.0.83. Internal testing only; do not promote to Production.

Published to Internal testing on 16 November 2026. Play Console verified “Available to internal testers”, release 41. Backend commit 532f5af deployed successfully; protected live settings route returns 401 without authentication. No Production promotion.
