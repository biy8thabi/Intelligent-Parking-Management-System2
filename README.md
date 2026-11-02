# Intelligent Parking Management System - Admin Website

Admin website for the ParkWise parking system (Vite + React). It talks to the backend API only, never to the database.

## Pages
| Group | Page | What it does |
|---|---|---|
| Overview | Dashboard | Live bay counts, occupancy bar, active sessions, quick links |
| Operations | Active Sessions | Live sessions, time parked, Force End |
| | Session History | Every session (active, completed, cancelled) with fees, search, filter, CSV |
| | Available Bays | Free bays by zone, accessible bays, filters |
| | Parking Spaces | Every bay and its status (view only), filters, CSV |
| | Tickets | Issued tickets with vehicle and bay, search, CSV |
| People and vehicles | Drivers | Registered users, search |
| | Vehicles | Vehicle register: add, edit, delete, link to a driver, CSV |
| | Password Requests | Drivers who forgot their password: reset (temporary password shown once) or dismiss |
| Insights | Reports | Occupancy, Zones, Active Sessions (stay length, estimated fees), History and Fees, Drivers; each with CSV |
| | Fee Calculator | Estimate at R10/hour (same rule as the backend) |
| Account | Settings | Theme, auto-refresh interval, change password |
| | Admin Profile | Read-only account details |

## Backend routes used
- POST /api/auth/admin-login, GET /api/auth/me, PUT /api/auth/change-password
- GET /api/admin/sessions/active, POST /api/admin/sessions/:id/force-end
- GET /api/admin/sessions, GET /api/admin/parking-spaces, GET /api/admin/tickets
- GET /api/admin/users
- GET, POST, PUT, DELETE /api/admin/vehicles
- GET /api/admin/password-requests, POST /api/admin/password-requests/:id/reset and /dismiss
- GET /api/parking/availability (public)

If a route is not deployed on the server yet, that page shows "... is not available on the server yet" instead of breaking. Other pages keep working.

## What the site does not do (the backend has no routes for it)
- Payments and confirmed revenue. "Fees charged" on completed sessions is shown instead, clearly labelled, because nothing in the backend marks a session as paid.
- Adding, editing or deleting parking spaces.
- Trends beyond the 7-day fees table in Reports.

## Code layout
- `src/styles.css` - all styling (colour tokens at the top)
- `src/components/ui.jsx` - shared page pieces (header, card, stat box, notice, badge)
- `src/components/Layout.jsx` - sidebar menu and top bar
- `src/services/api.js` - every backend call
- `src/utils.js`, `src/useLoader.js`, `src/useAutoRefresh.js` - shared helpers
- `src/pages/` - one file per page

## Deploy (Render Static Site)
Build: `npm install && npm run build`   Publish: `dist`
Rewrite rule: `/*` -> `/index.html` (Rewrite)
Optional env var: VITE_API_URL (defaults to the Render backend).
