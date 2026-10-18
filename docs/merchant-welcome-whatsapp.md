# Merchant onboarding welcome message

The server sends this template only after merchant, authentication account and profile creation succeed (Admin and Field Manager onboarding). Password resets continue to use the existing account-ready template. Existing merchants are not bulk-messaged.

## Activation

1. Apply `supabase-onboarding-welcome-bonuses.sql` after `supabase-merchant-point-allocation.sql`. This gives each newly onboarded merchant a one-time, platform-funded 2,000 AE point credit and records it in `merchant_onboarding_bonuses`. It does not retroactively credit existing merchants.
2. Create and obtain approval for a Meta WhatsApp template named `ae_merchant_welcome_v1`, with the body below and two positional text variables. Promotional content may be classified as Marketing by Meta. Use the language matching `WA_TEMPLATE_LANGUAGE`.
3. The backend uses `ae_merchant_welcome_v1` by default. If the bonus migration is missing or the credit fails, it sends the existing account-ready message instead, so the welcome template does not promise an uncredited bonus.
4. Test using a merchant phone number you control. Check `whatsapp_messages` delivery status; API acceptance alone does not prove handset delivery.

## Body (single copy, without pasted escape characters)

🎉 *Welcome to AE, {{1}}!*

Your shop *{{2}}* is now officially part of the AE network. 🚀

🎁 *Your AE Welcome Bonus: 2,000 AE Points*

Use your welcome points to get started with AE and reward your customers. These are AE reward points, not cash.

With AE, you can:
✅ Reward customers
✅ Bring customers back
✅ Create offers
✅ Build customer relationships
✅ Grow your business

*Your AE journey starts now!*
👉 Open the AE app and get started.

*Welcome to AE — Let’s Grow Together! 🚀*

Variables {{1}} and {{2}} currently both use the stored merchant/shop name; onboarding does not store a separate owner name. No passwords are included in this welcome template. The onboarding credentials screen remains available for sharing login information.
