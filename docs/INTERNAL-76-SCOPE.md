# AE Internal testing 76 (1.0.75)

Package: com.affiliateae.app. Internal testing only.

Customer UI baseline: public version 74, source 6627604. Customer pages, layout, product-list panel and customer styles restored from that version. Three optional TypeScript prop declarations accommodate current routing/editor callers without changing rendered customer screens. Latest shared authentication and backend integrations remain.

Merchant/Field Manager scope: multiple peak and low time ranges, onboarding capture, Admin and assigned Field Manager editing, merchant read-only view; delivery, 24-hour and product-list chat settings; assigned-shop customer onboarding records, transactions and own visits with pagination. Shop time ranges and operating settings use existing Firebase merchant profile settings. Financial/customer records remain in Supabase.

Backend main: 205bd42, Vercel success confirmed. App release checkout is separate from main so it does not revert the live website customer UI.

Checks: TypeScript and production web build passed; backend syntax passed; trading-range validation and role/assigned-shop checks passed; Gradle bundleRelease succeeded; jarsigner reports jar verified. Built customer assets contain no ae-immersive-hero, ae-fixed-hero-background or ae-hero-points markers.

AAB SHA256: 4899ABA1422BD90C00A42E6F26CC146AA2731B3ABCA886DCA237EC8D29E04DEE
AAB bytes: 17028965

Real-phone onboarding and settings persistence still require tester verification. No live customer/merchant records were created to test this release.
