# ParkWise Admin — Backend Integration Prepared

This React/Vite admin site is configured to use the existing Express API at `https://intelligent-parking-management-system2-4.onrender.com`. No Supabase service-role key belongs in this project.

## Run locally

1. `npm.cmd install`
2. Optional: copy `.env.example` to `.env` if you need to override the default. `VITE_API_URL` must be the **Express backend base URL** (not the Supabase URL). Do not add a trailing `/`.
3. `npm.cmd run dev`

## Implemented frontend integration

- POST `/api/auth/admin-login` — admin sign-in (JWT in sessionStorage, cleared on sign-out/tab session end)
- GET `/api/auth/me` — revalidate administrator on refresh
- GET `/api/admin/sessions/active` — live active sessions
- POST `/api/admin/sessions/:id/force-end` — explicit confirmation and server mutation
- 401/403 cause sign-out; network/API errors are shown, not replaced with demo data.

## Not yet verified

The frontend has not been live-tested against the deployed API in this review. Successful sign-in depends on the backend returning `{ token, admin: { role: "admin", ... } }`, `/api/auth/me` returning an `admin` object, and the deployed API allowing the frontend origin through CORS.

## Not available in documented admin API

Parking lots/slots management, drivers, vehicles, bookings, payments, tickets and revenue metrics need additional admin routes. These pages now show a clear integration-pending message instead of fake CRUD records. Fee calculator remains a **clearly labeled local preview**, not a real pricing/payment/ticket function. Settings preferences remain browser-local and must not be mistaken for backend settings. Admin profile is read-only from the authenticated server response.

## Security

Never put `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, passwords or other secrets into frontend files or Vite env variables. Rotate the service-role key previously shared in chat. `VITE_` variables are public in the browser bundle. Backend must enforce role/ownership checks and CORS; CORS is not authentication. For stronger security, consider moving JWT handling to secure HttpOnly cookie sessions in a future backend update.


## Fixes in this revision

- One `<BrowserRouter>` only (it was nested twice, which crashed on start-up).
- Login now stores the token and redirects; `configured` is a boolean, not a function.
- `src/auth.js` holds token/theme storage; `App.jsx` passes `token` and `onUnauthorised` to pages.
- `request()` errors now carry `.status`, so 401/403 correctly sign the admin out.
- `forceEndSession(id, token)` argument order fixed in `Sessions.jsx`.
- Reports uses the same sessions helper and the `active_sessions` response shape.
- Theme toggle works (dark default, saved in the browser).
- Sidebar links fixed; `/admin-profile` page added (read-only, from `/api/auth/me`).
- Lots, Slots, Bookings, Drivers and QR Tickets show a "waiting for backend" page; `/payments` shows the payments page (it was previously shown on every one of those routes).
- Dependencies pinned to the versions in `package-lock.json`; `vite.config.js` added.
- `src/pages/Drivers.jsx` is not routed (it needs a `getAdminUsers` API call the backend does not document).
- Reports: the Revenue tab calculates from `/api/admin/payments` (only completed/successful/paid payments count; period filter, daily table, CSV, print). The Active Sessions tab shows bay, start time and live "time parked", sorting, summary cards, and auto-refresh using the Settings interval.
- Top bar: the search box now jumps to a page by name; the notification bell opens Settings (no fake unread dot).
- Payments and Vehicles now sign you out when your session expires.

## Deploying on Render (static site)

- Root Directory: `admin-dashboard` (if the repo has other folders)
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`
- Environment variable `VITE_API_URL` = your backend URL (no trailing slash); redeploy after changing it.
- Redirects/Rewrites: add a rewrite `/*` -> `/index.html` so refreshing on `/reports` works.
