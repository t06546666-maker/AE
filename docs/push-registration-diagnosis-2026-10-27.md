# AE push registration diagnosis — 27 October 2026

Phone: realme RMX3840, existing AE account preserved.

- Firebase production configuration fetched and matched the bundled Android app ID, project and API key.
- Firebase installation ID and installation authentication succeeded on the phone.
- Separate diagnostic app using Firebase Messaging 25.0.1 did not complete messaging token registration after 30 seconds.
- Separate fresh diagnostic identity using Messaging 24.1.2 with AE's Firebase Auth 24.0.1 completed messaging token registration in approximately four seconds.
- AE version 50 (1.0.49) pins Messaging 24.1.2; no merchant diagnostic UI added.
- Release AAB built successfully and signature verified.
- SHA256: 65A534920B7519092D829F317A18AC5046AFEC2D7DCFF060B5F9DBD2FA66DB13

Limitation: a messaging token in the diagnostic app is not proof that the Play-installed merchant app saves its token or receives background checkout push. Version 50 must be updated through Play and tested end to end. No claim of confirmed production notification delivery.
