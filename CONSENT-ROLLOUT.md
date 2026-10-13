# Consent rollout

The in-app gate covers customer and merchant accounts, including self-registration and team onboarding. Three unchecked confirmations are required. Role terms and privacy details open inline. Acceptance is stored against account, role and document versions with a timestamp; v2 signifies all three confirmations. Login remains allowed to reach the gate.

Before live activation, apply supabase-legal-acceptance.sql and verify service-role select/insert access. Finalise Legal.tsx documents, still marked as drafts with retention/provider details awaiting review. Then enable LEGAL_ACCEPTANCE_ENABLED=true and redeploy. The flag remains unchanged to avoid blocking users against an unverified database. Rebuild Android for native distribution.

Test new customer/merchant accounts, self/team onboarding, decline/sign-out, failed saves, incomplete requests, acceptance after relaunch, account switching and new document versions. Staff must not accept on a user's behalf.

This is a UI gate, not API-level business-route enforcement. Device and optional marketing permissions remain separate. No live deployment or Play upload performed by this change.
