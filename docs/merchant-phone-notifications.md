Merchant phone notifications
============================

AE login remains the existing authenticated account. A separate Firebase Auth
login is not needed for Firebase Cloud Messaging. An email identifies the
account; an FCM registration token addresses the installed phone app.

The native registration listener sends the token to the authenticated
PUT /api/profile/preferences endpoint. The server stores trusted profile ID,
account email, role, merchant ID, token, enabled preference and update timestamp
in Firestore ae_profile_push_registrations/{profileId}. Body-supplied identity
fields are ignored. Supabase profiles remains a compatibility mirror.

Merchant checkout pushes and authenticated phone status/tests read this Firebase
registry, falling back to legacy fields only where a Firebase value is absent.
Firestore read failures do not fall back to a potentially outdated opt-in.
Customer registrations continue using ae_customer_notifications.

The registry must be private to the backend Firebase Admin SDK. Do not expose
tokens through APIs or enable browser reads/writes. Firestore rules should deny
client access to this collection (including authenticated Firebase clients):

    match /ae_profile_push_registrations/{document=**} {
      allow read, write: if false;
    }

Overlapping broad allow rules must also be removed or narrowed: Firestore allow
rules are additive. Do not replace unrelated production rules blindly.

No SQL migration is needed. A phone must still generate and submit its FCM token;
changing storage does not create a missing token. FCM acceptance is not proof of
delivery. Validate background/locked-screen receipt and tap-to-checkout on device.
