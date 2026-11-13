# AE Internal testing 79 (1.0.78)

Package: com.affiliateae.app. Internal testing only.

Adds optional Use my location to the Field Manager shop visit form. Geolocation is requested only on button press with a 15-second timeout. Successful location places the shop pin, which remains adjustable. Denied/unavailable location shows an error and manual pin selection remains available. Coordinate inputs remain hidden. Demo mode uses sample coordinates and never requests or saves real location.

Inherits version 78 shop tracking, merchant profile settings, onboarding, assigned-shop business information and the public version 74 customer layout. No new customer redesign.

Validation: shop tracking backend tests, Firebase compatibility, TypeScript, production web build and Capacitor sync passed. Demo button and selected-pin state verified. Real phone location permission and accuracy still require Internal tester validation.

Gradle bundleRelease passed; jarsigner verified. AAB SHA256: B065FD2D664B14D5A062F92A6C805DDFB5F9375EE906E339754B3E693C445BEB

Published Internal testing release 37. Play Console verified Available to internal testers, one version code 79, last updated 14 November 2026 00:01 IST. Only non-blocking missing-deobfuscation-file warning; no devices lost. Production was not changed.
