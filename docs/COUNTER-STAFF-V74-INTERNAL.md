# Internal release 74 — Checkout notices and Counter Staff

Version code 74; version name 1.0.73; package com.affiliateae.app.

Scope: existing published v62 customer UI baseline plus prior Counter Staff features, duplicate registered-number warning, friendly cash-selection notice and UPI-return reminder with OK to Home. Both notices support English/Malayalam and do not claim or record successful payment. Counter Staff cannot add a previously registered customer or issue points/messages from that attempt. The separate local Content Studio, new customer UI/carousel changes, and renewal scheduler are excluded.

Source: feature cd7e251; release cherry-pick 607afbc; main 7f19fda. Vercel Production 24XCJMnoR5XZQABmiPMP6gownnGL Ready 10 Nov 2026 12:33:52 IST.

AAB: C:/Users/91730/Downloads/AE-1.0.73-v74-Checkout-Notices.aab
SHA256: F6432587D827889D6B447A435327ED2687BFBC964C9E25EC725811B5A7FB04A4
APK: C:/Users/91730/Downloads/AE-1.0.73-v74-Checkout-Notices.apk
SHA256: 8DD232E962FF57C54B909245605AA0FB16033E56A28816270FC8823E197B42A3

TypeScript/backend checks, Counter Staff regression and registered-customer no-side-effect tests passed. Local English/Malayalam notice UI and OK routing verified. Real Android UPI switch/return still needs device testing. Build bundleRelease/assembleRelease, jarsigner, apksigner and aapt version checks passed. Demo carousel/Content Studio absent from built assets.

Internal testing only. No Production promotion authorized for version 74.
