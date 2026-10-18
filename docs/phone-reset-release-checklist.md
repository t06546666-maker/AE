# Password-reset fix for the next Android bundle

The published v37 (1.0.36) was built from `ae-play-build-ac0912f`, whose reset page uses browser Firebase Phone Auth inside the WebView. Do not rebuild that unchanged checkout for this fix. The updated source is in `affiliate-ae-whatsapp-ordering-update`.

## Code changes

- Installed Android apps use the native Firebase Authentication plugin; browsers continue to use Firebase's web CAPTCHA.
- Register all native result listeners before starting verification. A resolved initiation promise is not treated as an SMS result.
- Handle SMS-sent, delayed verification failure, instant/automatic verification, timeout, duplicate submission, cancellation and listener cleanup.
- Before resetting a native user's password, require the currently verified Firebase phone number to match the number entered for this reset.
- Remove automatic SMS sends on phone-field blur. Show localized, actionable errors rather than raw Firebase errors.
- Never disable Play Integrity or CAPTCHA to work around verification failures.

## Firebase configuration (not verified remotely yet)

1. In Play Console → App integrity → App signing, obtain the **app signing** SHA-1 and SHA-256 fingerprints. The upload-key certificate is not the same identity used by Play-installed apps.
2. In Firebase Console → Project settings → Android app `com.affiliateae.app`, verify those fingerprints are registered. Retain debug/upload fingerprints if those installations also need to be tested.
3. Verify Authentication → Sign-in method → Phone is enabled and SMS region policy permits India.
4. Download current `google-services.json` if the Android app configuration changed. Keep web and Android configurations in the same Firebase project.
5. Keep the Firebase-authorized web domains correct for browser password resets; do not use WebView browser verification as the Android implementation.

The local Android package and web/native Firebase project IDs match. The downloaded Google Services configuration has zero Android OAuth clients; this is not proof of current console fingerprint registration. The actual console settings still need inspection.

## Verification and release gate

- Run `node tests/phone-reset.cjs`, `node tests/localization/merchant.cjs`, `node tests/localization/packs.cjs`, and `npm run build`.
- Sync Capacitor into Android before making a new signed bundle. Use an unused version code greater than 37; do not reuse or overwrite the already-published v37 artifact.
- Upload the new bundle to **internal testing first** and install it from Play Store. A debug install does not validate Play's app-signing certificate.
- With an explicitly authorized test account, verify SMS delivery, wrong-code handling, correct-code reset and login using the new password; also verify automatic phone verification when available.
- Promote that same tested bundle to production only after the Play-installed test succeeds. No real SMS or password reset was performed during the local code tests.

References: https://firebase.google.com/docs/auth/android/phone-auth and https://capawesome.io/docs/sdks/capacitor/firebase/authentication/
