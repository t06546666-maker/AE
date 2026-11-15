# AE Internal testing 81 (1.0.80)

Internal testing only. Package com.affiliateae.app.

Base: version 80, preserving its Field Manager merchant activity, onboarding, transactions and visit flows.

Adds the current customer home presentation: portrait hero, visible points panel, scrolling navigation behavior, Exclusive Products with Frovia Vanilla/Choco Luscious/Mango Magic cards, 3D featured carousels, single-line progress, category and nearby offer presentation, English/Malayalam labels.

VITE_CUSTOMER_UI_REVIEW=1 opts this Internal build into the approved website artwork/layout configuration so the app matches the review preview. This does not modify saved carouselAppIds or the currently published app.

Uses the live backend, existing authentication and existing native Firebase/notification configuration. No new database migration, permissions or payment/reward-rule changes.

Validation: Firebase compatibility, TypeScript and Vite build passed; Capacitor sync and signed Gradle bundleRelease passed. Existing trading-time, IST transaction date and field access checks passed. AAB assets checked for new customer hero, Exclusive Products, featured artwork and review mode. jarsigner verified. No real-device verification claimed.

SHA256: f806011754d9cf04173c8cde3ab4294847f2fe22118421628310ba39ebe3326f
