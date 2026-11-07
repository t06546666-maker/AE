# Merchant daily push reminders

Scheduled targets: 09:00, 13:00 and 18:00 Asia/Kolkata, daily. English greetings with seven Malayalam messages per slot, rotating by the local calendar date (repeats weekly). Edit backend/merchant-reminder-messages.json to change approved wording; no model or paid AI API is used.

GitHub Actions calls the production backend at UTC 03:30, 07:30 and 12:30, with 10/20-minute backup triggers. GitHub schedules are best effort, may be delayed/dropped, and public-repository schedules can be disabled after 60 days without repository activity. This is not a guaranteed exact-minute service. The backend accepts sends only in the corresponding India-time hour; excessively delayed runs are skipped rather than sending the wrong greeting.

Only active shops and merchant-role profiles with an enabled, registered push token receive reminders. Existing push preferences are respected. No WhatsApp is sent, no customer is targeted, and no diagnostic banners or permission prompts are added. Tapping opens checkout requests, offers or dashboard. No AAB update or new database migration is required.

The workflow receives a short-lived GitHub OIDC identity; the backend checks its signature, issuer, audience, repository ID, main branch and exact workflow path. No Firebase or Supabase secret is stored in GitHub. Firestore create-only date/slot/device locks prevent repeated alerts, including concurrent runs. Failed/ambiguous sends are logged and are not automatically retried. Locks remain if a function dies after claiming to avoid duplicate alerts; that recipient may miss that reminder. Provider acceptance does not prove delivery to the phone.

Firestore audit: ae_merchant_daily_reminder_deliveries and ae_merchant_daily_reminder_runs. Manual workflow dispatch is strictly dry-run; it checks recipients without writing or sending. To stop future reminders, disable Merchant daily reminders in GitHub Actions. Large accounts are processed in pages of 20 shops; workflow duration is capped at 15 minutes.

## Approved weekly copy
The message bank contains the exact 21 messages reviewed and approved in chat on 7 November 2026. Day 1 is 7 November; day 8 repeats day 1. Each day selects the matching morning, afternoon and evening entry. The original three first-day messages are retained. English titles remain fixed. The 14-day test validates each message, time, title, destination and week wrap. Updating copy does not reset delivery locks or trigger immediate notifications. Future extra messages can be added by editing the per-slot arrays; rotation uses each array length.
