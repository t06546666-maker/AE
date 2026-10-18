# Customer welcome WhatsApp

The current Meta customer template is named `welcome`. Its body has one text variable (the customer's name) and no media header. The backend sends that exact text-only payload for a newly created customer; existing customers receive the purchase-reward template instead, so they do not repeatedly receive an install/welcome offer.

Apply `supabase-onboarding-welcome-bonuses.sql` before deploying the backend. It awards each new customer 200 platform-funded AE points once and records the grant in `customer_onboarding_bonuses`. A customer created by a merchant receives the points in the new shop membership. A customer who self-signs up first receives the points in their account; the database attaches them to the first shop membership they later join.

If the points grant fails, the promotional welcome template is skipped rather than promising a bonus that was not credited. The separate temporary-password message can still be sent for merchant-created accounts. Self-signup does not send the Marketing WhatsApp template because the signup flow currently does not collect a separate WhatsApp marketing opt-in.

Meta template names, language, approval status, and variable order must match the templates configured in WhatsApp Manager. API acceptance is not proof of delivery; inspect `whatsapp_messages` for delivery status.
