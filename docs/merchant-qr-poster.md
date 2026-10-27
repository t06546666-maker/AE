# Merchant QR poster

Admin navigation: Merchants → open merchant → QR Poster (`/merchants/:id/qr-poster`) or QR Common (`/qr-common`) (admin only).

The protected `/api/admin/merchants/:id/qr-poster` endpoint checks the merchant in Supabase and gets or creates its persistent Firestore `ae_shop_qr` token using the same transaction helper as the merchant app. Reopening a poster does not rotate its QR. Field Manager onboarding requires no separate QR upload: once the merchant exists, Admin can open its poster. No SQL migration or balance/attendance changes.

The poster template uses the official AE logo, editable Malayalam headlines and scan instruction, the real merchant name, and store code badge. Malayalam requires a locally installed Malayalam-capable font. No claim of embedded fonts or CMYK/bleed export is made. Test-scan the first physical print using AE's customer scanner before distribution. This QR carries the app's JSON shop payload, not a generic camera URL or UPI payment link.

Presentation controls offer Bold/reference (default) or Clean, 18–30 pt headline size, left/centre/right alignment, individual headline colours, and a toggle to show/hide the merchant store code on the poster.

Four heading cards appear in one row: Original, Happiness, Savings and Growth. Each replaces only the three headline lines and remains editable afterwards. The scan label, QR and merchant identity are unchanged. Boldness, cyan accents and gradient/outline scan-label controls are also included.

### Paper & sheet layouts
1. **2 in 1 Page (Default · A4 Landscape · 2 side-by-side)**:
   - Fits two A5 posters onto one standard A4 landscape sheet (297 × 210 mm).
   - In `/qr-common`, shops are arranged in pairs (Slot 1: Left, Slot 2: Right) per A4 landscape page.
   - Subtle vertical dashed cutting guideline at 148.5 mm with center scissor marker (✂) for trimming into 2 individual A5 posters.
   - In single-merchant `/merchants/:id/qr-poster`, 2-in-1 mode prints 2 identical copies on 1 A4 landscape sheet.
2. **A3 Sheet (4 in 1 · 2×2 grid)**:
   - Fits four A5 posters onto one standard A3 portrait sheet (297 × 420 mm).
   - In `/qr-common`, multiple shops are arranged in groups of 4 per A3 page.
   - Subtle dashed cutting guidelines (horizontal at 210 mm and vertical at 148.5 mm) with center cut markers provide clear guidance for cutting into 4 individual posters.
   - In single-merchant `/merchants/:id/qr-poster`, A3 sheet mode prints 4 copies of that shop's poster on 1 A3 sheet.
3. **A5 Single (1 poster per page)**:
   - Individual A5 portrait poster (148 × 210 mm).

### Shop arrangement in QR Common (`/qr-common`)
- Lists merchants with search, pagination, and QR thumbnails.
- Selected shops appear in the **Arrange & review shops** section, organized by sheet according to the selected layout (2 in 1 Page, A3 Sheet, or A5 Single):
  - In 2-in-1 mode, shop cards show their slot (Slot 1: Left, Slot 2: Right), store name, merchant code, and assigned heading slogan.
  - In A3 mode, cards show quadrant slots (Slot 1: Top-Left, Slot 2: Top-Right, Slot 3: Bottom-Left, Slot 4: Bottom-Right).
  - Interactive **Move Up (↑)** and **Move Down (↓)** buttons allow rearranging the order and slots of shops before printing.
  - Interactive **Remove (✕)** button removes a shop from the batch.
  - Empty slots on the final sheet are cleanly handled with placeholder cards and print as blank cutting space.
- Heading rotation automatically tracks the user's arranged sequence.
- Preview iframe renders the combined sheets before printing or saving.
- Print / Save selected as PDF triggers the browser's print dialog configured with `@page { size: A4 landscape; margin: 0; }` (or A3 portrait / A5 portrait).

Verification: `node tests/merchant-qr-poster.cjs`, `node tests/qr-common.cjs`, `node tests/shop-checkout-requests.cjs`, `npm run build`.
