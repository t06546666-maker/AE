# Merchant QR poster

Admin navigation: Merchants → open merchant → QR Poster.
Route: `/merchants/:id/qr-poster` (admin only).

The protected `/api/admin/merchants/:id/qr-poster` endpoint checks the merchant in Supabase and gets or creates its persistent Firestore `ae_shop_qr` token using the same transaction helper as the merchant app. Reopening a poster does not rotate its QR. Field Manager onboarding requires no separate QR upload: once the merchant exists, Admin can open its poster. No SQL migration or balance/attendance changes.

The A5 portrait template (148 × 210 mm) uses the official AE logo, editable Malayalam headlines and scan instruction, and the real merchant name. The printable HTML download is self-contained, including logo and SVG QR. Print / Save PDF opens a print-only document; choose A5, 100%, zero margins, background graphics and disable browser headers/footers. Malayalam requires a locally installed Malayalam-capable font. No claim of embedded fonts or CMYK/bleed export is made. Test-scan the first physical print using AE's customer scanner before distribution. This QR carries the app's JSON shop payload, not a generic camera URL or UPI payment link.

This release is one merchant per poster. Bulk printing, QR-PDF import/matching and saved brand-template settings are not implemented. Text edits are local to the current page; merchant names come from the saved merchant profile.

Verification: `node tests/merchant-qr-poster.cjs`, `node tests/shop-checkout-requests.cjs`, `npm run build`.
