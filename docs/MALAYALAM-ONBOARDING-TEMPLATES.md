# Malayalam WhatsApp customer onboarding

Verified read-only in Meta WhatsApp Manager on 6 November 2026:

- ae_welcome_bonus_ml_1: Active; body variables customer name, AE app URL, Instagram URL.
- temporary_2: Active; static instructions to use the phone number's last six digits. No variables, image header or password value are sent. Only new merchant-added customers with matching generated credentials qualify.
- ae_use: Active; body variables AE app URL, Instagram URL. Sent as the customer onboarding guide.

All three are registered under English (en) in Meta, with Malayalam body text. Onboarding payloads use en; do not switch them to ml without creating/approving that locale.

Legacy server settings WA_REGISTRATION_TEMPLATE=welcome and WA_TEMPORARY_TEMPLATE=temporary resolve to the approved replacements. Defaults are also the new templates. WA_CUSTOMER_USAGE_TEMPLATE defaults to ae_use; an empty value disables the guide. WA_CUSTOMER_INSTAGRAM_LINK defaults to https://www.instagram.com/ae.kerala/.

Self-signup sends welcome and guide only, after successful welcome-bonus processing. Merchant-added customers receive welcome, eligible password instructions and guide. Welcome/guide copy is skipped when the bonus was not credited; password delivery remains independent. Each message uses the existing WhatsApp delivery log. This does not change passwords, OTP, merchant account messages or balances.

Validation uses mocks and sends no real messages. After backend deployment, use a new demo customer and inspect WhatsApp delivery logs/recipient messages. Existing customer logins do not resend onboarding. Meta labels ae_use as Marketing; acceptance/delivery is subject to Meta controls.
