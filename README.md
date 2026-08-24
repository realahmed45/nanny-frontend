# My Nanny — Admin Dashboard

React + Vite + Tailwind dashboard for the My Nanny childcare marketplace.
It talks to the backend's `/api/admin` endpoints (see the `nanny-backend` repo).

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

In development Vite proxies `/api` to `http://localhost:4000`, so start the
backend first. Sign in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` configured
there (default `admin@mynanny.com` / `admin123` — change it after first login).

```bash
npm run build        # production bundle in dist/
npm run preview      # serve the built bundle locally
```

---

## Screens

| Page | What it does |
|---|---|
| **Dashboard** | Live counts for bookings, nannies, families and revenue, plus 14-day booking/revenue trends and a shortcut to nannies awaiting verification |
| **Bookings** | Every booking by status, full detail (schedule, children, service days, payments, rating), a refund preview, and admin cancellation |
| **Nannies** | Verify / reject / suspend / delete, review uploaded documents, see ratings, skills and availability |
| **Families** | Accounts, saved addresses, children on file, ID verification and blocking |
| **Payments** | Family payments in and nanny payouts out, with the three summary cards from the spec and manual payout release |
| **Support** | Tickets from families and nannies; replies are delivered over WhatsApp |
| **Chats** | Relayed family–nanny threads and the raw inbound/outbound WhatsApp log |
| **Settings** | Business rules, WhatsApp connection status, webhook URL, and an ad-hoc message sender |

---

## Deployment (Vercel / Netlify)

- Build command: `npm run build` · Output directory: `dist`
- Set `VITE_API_BASE` to your deployed backend, e.g.
  `https://your-backend.onrender.com/api/admin`
- SPA routing is already configured (`vercel.json` and `public/_redirects`)

Make sure the backend allows requests from the dashboard's origin — CORS is
currently open, so tighten it in `server/src/index.js` before going live.
