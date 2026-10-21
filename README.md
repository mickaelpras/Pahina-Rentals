# Pahina Rentals

Party equipment rental booking & management for Angono / Teresa, Rizal — by Pahina Digital Studio.

- **Customers** (`/`): catalogue with prices, availability by date, booking request, GCash deposit receipt upload, booking status page. English / Tagalog, mobile first.
- **Staff** (`/admin`): planning of deliveries & pick-ups, bookings, receipt verification, payments, damages, stock, settings. PIN protected.

## Stack
Static HTML/CSS/JS in `public/` (no build step) + Netlify Functions (`netlify/functions`) + Netlify Blobs for data and uploaded images. Business logic lives in `netlify/lib/app.mjs`.

## Netlify setup
1. Environment variable `ADMIN_PIN` (scope: Functions) — the staff PIN.
2. Link this repository to the Netlify project: publish dir `public`, functions `netlify/functions` (already in `netlify.toml`).
3. In `/admin` → More → Settings: GCash number and name, contact number, Messenger link, delivery fees.

## Local
```bash
ADMIN_PIN=1234 node dev-server.mjs   # http://localhost:8888 (in-memory data)
npm test                             # API tests
python3 tests/e2e.py                 # browser walkthrough (needs Playwright)
```

## Notes
- Stock is held from `bufferDays` before the event to `bufferDays` after (delivery / pick-up). Unpaid requests stop holding stock after `holdHours`.
- Item pictures are illustrations; upload real photos from Stock → item → Upload photo.
- Data is small-business scale (all bookings loaded per request). Past a few thousand bookings, move to Netlify DB.
