# Merchant removal — 27 October 2026

Admin permanently removes merchant authentication/profile records and shop contact/content fields. Customer records, points, orders and payments remain. A scrubbed `Deleted merchant` bookkeeping reference preserves shared financial keys and customer history. This is not a restorable archived shop account.

`active_merchants` is a service-only view used for directories, mapper, posters, QR lookup and shop access. Embedded historical merchant references continue to resolve to `Deleted merchant`. Old shop QR payloads cannot create new requests because the active-shop lookup fails. Database triggers also reject new orders for removed shops.

Removal is a single locked, admin-only transaction. Operational catalogue/offers/field shop records are removed. Auth/profile deletion and all other changes roll back on any failure. Customer balances and transaction rows are not deleted or reset.

A private durable cleanup job removes shop QR credentials, merchant phone tokens/inbox, sales targets and unshared uploaded shop images. Customer checkout records remain and pending QR requests are cancelled. Failed cleanup is retried on subsequent Admin merchant-list visits. Only local project storage paths under `shops/` are eligible for file cleanup.

Validation: application removal/security/cleanup/map checks passed; TypeScript and web build passed. Production schema installed. An isolated transaction created a temporary merchant login/customer/order/paid payment, performed removal, asserted customer data and points unchanged and purchase/payment retained, asserted login removed/shop absent, repeated removal, then rolled everything back. No real store was removed.
