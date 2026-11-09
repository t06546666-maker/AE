# Counter Staff history and checkout review

Merchant: open Counter Staff, then select a staff avatar/name to open that employee's paginated history. Counter Staff: open Transaction history to see their own records. Only the authenticated merchant or that staff member can read the history. Existing audit records are reused; no migration required.

Customer: scan shop QR, choose Earn only or Redeem 100 points + earn, enter bill amount, review the server-calculated discount/payable/points, then send for amount confirmation. Editing the amount or choice clears the preview. Changed rules require a fresh review. Redemption needs 100 available points and the owner minimum bill; earning alone has no redemption discount. Staff review the complete breakdown, confirm, return for correction, or cancel. Confirmation records the existing checkout exactly once and is not proof of payment receipt. Final history uses the checkout's returned discount when available.

Diagnosis (read only): the reported ₹1,200 completed test used action earn, redeemed zero points and correctly had zero redemption discount. The transaction was not changed.

Validation: TypeScript/backend checks, authenticated preview and no-write checks, invalid QR/insufficient balance/stale quote checks, ownership isolation, history pagination beyond 250 scanned records, duplicate/concurrent confirmation and correction/cancellation tests; product-list and checkout-handler regression tests; English/Malayalam switching and mobile layout checked with sample data.

Android delivery: build an APK for testing; no Play Store publication requested for this change. Physical-device delivery and real new checkout remain user validation steps.

## Date filters and rule editing (10 November 2026)
Merchant per-staff history and staff own history share Today, This week (Monday onward), This month, All time and inclusive Custom date ranges. Boundaries are computed server-side in IST; filters apply before pagination and ownership rules are unchanged. Invalid dates and reversed ranges are rejected. Current saved percentage values outside 1–20% remain selectable; new standard choices are 1% through 20%. Points/minimum-bill drafts allow blank input while editing and are converted/validated only on save. Setup guidance and new controls support Malayalam. No migration or transaction mutation. This follow-up is local only; not pushed, deployed or included in an APK yet.
