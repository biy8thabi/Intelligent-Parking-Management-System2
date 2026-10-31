# Parkwise Admin (works-now edition)

Admin website for the Parkwise Intelligent Parking Management System (Vite + React).
This edition uses ONLY backend routes that exist today. Everything else is hidden.

## What works
- Login (admin accounts only)
- Dashboard (live overview, active sessions)
- Active Sessions, with Force End
- Available Bays (counts, per-zone table, filters)
- Drivers (registered users)
- Reports: Parking Occupancy and Active Sessions, with CSV export
- Fee Calculator (R10/hour estimate)
- Settings: theme and auto-refresh interval
- Admin Profile (read-only)

## Backend routes used
POST /api/auth/admin-login, GET /api/auth/me, GET /api/admin/sessions/active,
POST /api/admin/sessions/:id/force-end, GET /api/admin/users, GET /api/parking/availability

## Hidden until the backend adds routes
Payments, Vehicles, Parking Spaces management, Tickets, Revenue report, session history,
password change. The full version is in parkwise-admin-FULL-needs-backend.zip and works once
backend-additions.zip is applied by the backend developer.

## Deploy (Render Static Site)
Build: `npm install && npm run build`   Publish: `dist`
Rewrite rule: `/*` -> `/index.html` (Rewrite)
Optional env var: VITE_API_URL (defaults to the Render backend).
