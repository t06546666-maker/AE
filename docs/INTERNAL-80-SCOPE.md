# AE Internal testing 80 (1.0.79)

Package: com.affiliateae.app. Internal testing only.

Field Manager flow: All Merchants -> shop name -> Customer onboarding or Transactions. Only the chosen activity list is shown; visit history remains below both options, followed by merchant operating settings. The activity section appears above trading-time settings. Loading, retry and empty states remain visible. English and Malayalam labels are supported.

Transactions default to today's date in Asia/Kolkata, with a date selector and All dates. The backend filters before pagination using inclusive IST midnight and exclusive next midnight. Customer onboarding and visits retain their existing shop/manager scope. No permissions were expanded.

Inherits version 79 shop tracking, movable pin, optional Use my location and the published customer layout. The customer redesign preview is excluded.

Web backend/source: aebd06a, Vercel deployment completed at https://vercel.com/t06546666-3573s-projects/ae/D63R3L7m25fXnYy4FG1ciW5XFjYG . No database migration.

Checks: TypeScript, production web build, Firebase compatibility and Capacitor sync passed. IST midnight/leap-day/invalid-date tests passed; merchant time-range/access tests passed. Local demo verified both buttons, today's filter and All dates with synthetic data. Real-device and live merchant records still require tester verification.

Gradle bundleRelease succeeded; jarsigner verified. AAB SHA256: 427C862745D4E1F18C2A0DF5CA2CA0807D5862E1FFB51EF5D1526DD437033DCF. Built assets contain no immersive customer hero markers.

Published Internal testing release 38 on 14 November 2026 at 13:00 IST (Play Console display). Verified Available to internal testers, one version code 80. Only non-blocking deobfuscation-file warning; no devices lost. No Production promotion.
