# Product-list fulfilment and contact UI

## Release changes

The merchant's customer profile no longer has a Call button. Customer offer previews retain Call Store and WhatsApp actions, as clarified by the user. Customer support and settings, merchant support, catalogue labels no longer promote WhatsApp. The merchant product-list helper section is removed entirely. Merchant onboarding delivery diagnostics and WhatsApp controls are hidden from merchant screens; Admin controls and existing backend onboarding messages remain available. Customer phone masking is unchanged.

Merchant product-list decisions are Confirmed, In progress, Order ready and Rejected. Pending review and Awaiting confirmation remain initial read-only labels. Ready and Rejected are final. Admin approval stays in the existing status field; merchant fulfilment uses merchant_status. This prevents a merchant's confirmed request disappearing from the approved list. Legacy accepted API input maps to confirmed.

The server loads customer ownership from the request record and sends an AE inbox/push notification for a changed status. Order ready has a dedicated notification and a link opening the customer's specific product-list history entry. Repeated identical updates do not send another notification. Concurrent updates use a conditional database update so only one decision succeeds. Push provider failure does not undo the saved order status.

## Deployment order

1. Apply supabase-product-list-fulfillment.sql to the intended live Supabase project. The migration is additive and repeatable. It does not change balances, orders or attendance. It protects the product-list table from direct anonymous/authenticated client access; the service-role endpoints continue to enforce ownership.
2. Deploy server.js and backend/product-list-fulfillment.cjs together, with the locale packs and frontend changes.
3. Publish the new Android bundle only after verifying the live API with separate merchant and customer accounts.

The user ran the migration in the live SQL editor on 31 October 2026. A read-only service-role check against project zrsjgbgzkaxccetjahcy confirmed merchant_status is available before backend deployment. The migration SQL itself was tested in isolated PostgreSQL, including safe rerun and direct-client permissions.

## Verification

Passed local route tests: merchant isolation, unapproved/rejected review blocks, legacy acceptance, four statuses, ready notification recipient and link, repeated requests, concurrent decisions, database/provider errors.

Passed isolated PostgreSQL tests: migration and rerun, legacy data conversion, allowed/invalid status constraints, pending data preservation and blocked direct-client access.

Passed product-list render tests, customer ad/offer checks, TypeScript and Vite build. Phone notification receipt and live database behavior remain unverified.
