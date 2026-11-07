# Manual customer guide

Admin → Customers → open a customer → Send How to use AE. Confirm the recipient before sending. Sends only the configured ae_use Malayalam guide, registered as en in Meta. No welcome or password message. Explicit WhatsApp opt-outs are blocked. The server resolves the saved phone number and logs each send; UUID reservations prevent duplicate processing. Meta acceptance is not delivery. Review WhatsApp logs if a request fails or remains pending before starting another send. No schema migration or Android build is needed.

## Multiple recipients
Admin Customers has Send to selected and Send to all customers. Selection uses the existing row/page checkboxes; selected IDs remain across pages. All customers ignores filters and reads every customer page. The preview excludes invalid, opted-out and duplicate phone numbers and confirms the eligible count before sending. Keep the page open: sends run sequentially in the browser, each protected by its own logged UUID. Closing/reloading stops remaining work. Results distinguish Meta acceptance from delivery and show failed/unconfirmed sends; check delivery logs before starting another send.

## Legacy database compatibility
Customer onboarding and manual usage-guide messages use the existing qr log category, matching queueWhatsAppMessage and the deployed WhatsApp check constraint. This is only an audit category: the outbound template remains ae_use and no QR image or temporary-password message is sent. No database migration is needed.
