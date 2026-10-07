# MedLink Ethiopia — Web App (Vue 3)

The single-page app for the MedLink Ethiopia pharmacy platform. The Laravel API lives in
`../../pharmacy_managment_system_back` — start it first (see its README for setup and demo accounts).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 (proxies /api to http://127.0.0.1:8000)
npm run build      # production build in dist/
```

Requires Node 20.19+ (Vite 7). Copy `.env.example` to `.env` to point the dev proxy at a different API
(`VITE_BACKEND_URL`), or set `VITE_API_URL` for a production build served separately from Laravel.
In development the sign-in page shows one-click demo accounts.

## What's inside

| Area | Screens |
| --- | --- |
| Public | Home, medicine search (live stock & price per pharmacy, filters by city / Addis sub-city / price / Rx / 24h / delivery), pharmacy directory and catalogue, cart & checkout (pickup or delivery; telebirr, CBE Birr, Chapa, cash, insurance), prescription check with "pharmacies that have everything" |
| Customer | My orders with a live progress tracker, notifications, profile |
| Pharmacy | Dashboard (sales chart, payment mix, top sellers, low stock, expiring batches), point of sale (barcode-friendly, loads a prescription by code/QR, printable receipt), online order queue with confirm / ready / dispense / partial fulfilment, inventory with FEFO batch view, stock adjustments, expiry tracker, stock movement history |
| Hospital | Dashboard, patient register (allergies highlighted), prescription writer with dose/frequency/day quantity suggestions and allergy warning, printable prescription with QR code |
| Platform admin | Approve/suspend organizations after licence checks, national medicine catalogue and categories |
| Shared | Reports with charts and Excel/PDF export, team & roles, audit log with field-level diffs, organization profile, notification centre |

### Ethiopian touches
* **English / አማርኛ** toggle (Noto Sans Ethiopic), remembered per user.
* **Ethiopian calendar**: today's E.C. date in the header; click it to show every date in E.C. instead of G.C. (the other calendar is always on hover). Receipts and prescriptions print both.
* ETB formatting, `09…`/`07…` phone formatting, regions → cities → Addis sub-cities → woreda, emergency numbers (907 / 991 / 939), flag ribbon and *tibeb*-inspired woven border pattern.

## Structure

```
src/
├── lib/            api client (token, error normalisation, file downloads), Ethiopian calendar, formatters, i18n
├── stores/         Pinia: auth (role/permission helpers), cart (one order per pharmacy), notifications (polling), meta, ui
├── composables/    useList (paginated + URL-synced filters), useForm (server validation errors), useFormat
├── router/         lazy-loaded routes guarded by auth, staff/customer area, permission and tenant type
├── config/         role-based sidebar navigation
├── layouts/        Public, Auth (split screen), App (sidebar workspace)
├── components/     ui kit, dependency-free SVG charts, dashboard widgets, inventory & order components
└── views/          public, auth, account, app/{pharmacy,hospital,admin}, shared
```

Role-based UI is a convenience: every rule is enforced again by the API.
