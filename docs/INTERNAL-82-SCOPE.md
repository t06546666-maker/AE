# Internal 82 (1.0.81): Counter Staff checkout

Retains the public v74 customer home UI from the established release baseline 55ea224. No customer Home, home CSS, carousel, banners, category or product-card presentation files changed. No customer UI review flag.

Adds merchant-controlled staff rule editing (off by default, revocable), saved points/discount/minimum bill rules and audit history. Customer scans shop QR without entering amount; active staff receives request, enters amount, previews saved rules and confirms. Staff Shop QR and Scan Customer QR shortcuts. English/Malayalam support. Existing staff-entered scan checkout uses saved rules and existing checkout engine/idempotency; confirmation never asserts payment receipt.

Preserves base version 80 Field Manager access and visit changes. Requires matching live backend update. Internal testing only; no Production promotion.

Validation: Firebase/TypeScript/Vite passed, Capacitor sync and signed Gradle bundleRelease succeeded. Signature verified. AAB checked for staff features and absence of the experimental customer hero/review flag; public v74 Home and CSS matched (type-only preview prop ignored). Local checkout/access/date/trading-time tests passed. Backend eeee837 deployed to affiliateae.co.in; new staff routes require authentication. No phone-camera/physical-device verification claimed.

AAB SHA256: 8abcb84c607e2d00496a6a16bc995d3edc793d6d60b31a2a2b9fcd1796b0f6fd

Published Internal testing release 40 on 15 November 2026 at 21:37 (Play Console display). Verified Available to internal testers, version 82 (1.0.81). Zero newly unsupported devices; optional deobfuscation warning only. Production version 74 was not promoted or changed.
