# Global redemption — 27 October 2026

Customers may redeem exactly 100 points from their total AE balance at any active shop, including a shop where they have never earned points. The Rs100 minimum bill requirement is removed; valid purchases of Rs1 or more are accepted. Discounts remain capped at the bill amount.

The database locks the customer and uses the existing idempotency key to prevent overspending/repeated deductions. Available funded lots are consumed across source shops in FIFO order; legacy membership buckets are reduced without negative balances. The redeeming shop receives only newly earned points in combined checkout, never a credit of redeemed points. The returned balance is the customer's global balance.

All redemption paths use the atomic database function, including deployments where legacy issue-only purchases still use process_purchase. The merchant scan endpoint and Android/web UI use total customer points and allow small bills. English and Malayalam eligibility copy is updated.

Verified in an isolated rollback transaction against the installed schema: Rs25 redemption at a new shop, 99-point rejection, duplicate replay, FIFO lot consumption, Rs10 combined checkout and capped flat discount, negative-bucket prevention, merchant allocation debit only for points issued, and full rollback if combined issuance fails. No existing customer balance was recalculated. Source/security checks, TypeScript and web build also passed.

Android version 51 (1.0.50) is required for the new bundled screen validation. Backend changes apply to the hosted web app once deployed; older Android screens can still enforce old minimums until updated.
