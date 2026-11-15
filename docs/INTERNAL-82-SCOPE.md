# Internal 82 (1.0.81): Counter Staff checkout

Retains the public v74 customer home UI from the established release baseline 55ea224. No customer Home, home CSS, carousel, banners, category or product-card presentation files changed. No customer UI review flag.

Adds merchant-controlled staff rule editing (off by default, revocable), saved points/discount/minimum bill rules and audit history. Customer scans shop QR without entering amount; active staff receives request, enters amount, previews saved rules and confirms. Staff Shop QR and Scan Customer QR shortcuts. English/Malayalam support. Existing staff-entered scan checkout uses saved rules and existing checkout engine/idempotency; confirmation never asserts payment receipt.

Preserves base version 80 Field Manager access and visit changes. Requires matching live backend update. Internal testing only; no Production promotion.
