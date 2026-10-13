# Customer scans shop QR

Merchant: open **Shop QR and checkout requests**, download the shop QR, and display it at the counter.
Customer: open **My QR Code → Scan shop QR**, scan, choose Earn points or Redeem + Earn, and send the request.
Merchant: open the foreground pop-up or notification; enter the actual amount and confirm using the existing checkout.
Customer: the request screen polls for completion; the existing points/bill notifications still apply.

## Deployment and verification

This is source implementation, not a verified production transaction. Deploy the backend and frontend together, then release an updated Android bundle (1.0.32 was built before this feature and does not include it).

Uses existing Firebase Admin / Firestore configuration and native push registration. No Supabase table migration is required for the request queue. Configure the compound Firestore index for `ae_shop_requests`: `merchantId ASC`, `status ASC` if Firebase requests it. Deny direct client access to `ae_shop_qr`, `ae_shop_request_locks`, and `ae_shop_requests`; only the authenticated server endpoints should access them. Do not replace existing Firestore rules wholesale.

Requests expire after ten minutes. A repeat scan returns the same pending request. Merchant ownership, selected customer/action, expiration, and a transaction-based one-time claim are checked on the server. No points are changed during scanning/request creation. Checkout errors or interruptions stay in `processing` / `needs_review`; reconcile the existing order and redemption before clearing the corresponding lock. Do not blindly retry uncertain redemptions.

Test with dedicated customer/merchant accounts: issue, redeem+issue with sufficient balance, insufficient balance, wrong shop/account, duplicate scan, simultaneous confirmation, expiry, camera denial, navigation during scanning, foreground request popup, and background notification tap. Existing checkout restrictions and the separate prorated-points database migration still apply.
