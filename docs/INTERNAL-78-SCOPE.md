# AE Internal testing 78 (1.0.77)

Package: com.affiliateae.app. Internal testing only.

Adds separate prospective-shop visit tracking: shop name, location pin, visit outcome, notes, follow-up date and immutable update history. Field Managers access their own records; Admin can view all records. Includes English and Malayalam views. Marking a visit onboarded does not create a merchant account.

Inherits version 76 merchant peak/low time ranges, delivery/24-hour/chat settings, onboarding, assigned-shop customer/transaction/visit views. Customer screens retain the published version 74 layout; the new customer redesign is excluded.

Live backend: main 9b9d6cc, Vercel success verified. Tracking records and history use Firebase collection ae_shop_visit_tracking; financial records remain in Supabase.

Safe local demo: http://localhost:3054/shop-visit-demo . Uses synthetic shops only and prevents saving to the live database.

Validation: backend role isolation, validation, atomic writes, stale-update protection and IST date tests passed; trading-time tests passed; TypeScript/web build and Capacitor sync passed; Gradle bundleRelease passed; jarsigner verified. Built customer assets contain none of the new customer hero markers. Real-device testing remains for Internal testers.

AAB SHA256: B1D72D440621949C4FA21E0DE2E7DA33F5868F81EC84FDCFD3D3F6A8CFD72D24

Location entry uses a map tap and draggable shop pin, with no latitude/longitude inputs or current-location request. Version 77 was uploaded but excluded before publication after the user requested this correction.

Published: 13 November 2026, 23:52 IST (Play Console display), release 36. Verified Available to internal testers, one version code 78. No production promotion. Google showed only the non-blocking deobfuscation-file warning; zero devices lost.
