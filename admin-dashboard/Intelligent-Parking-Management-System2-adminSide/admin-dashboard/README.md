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
