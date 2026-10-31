# ParkWise Admin Dashboard

React + Vite admin frontend for the ParkWise Intelligent Parking Management System.

## Run locally

1. Install Node.js LTS.
2. Open a terminal in this folder.
3. Run `npm install`.
4. Copy `.env.example` to `.env` and set `VITE_API_URL` to your deployed Express backend URL.
5. Run `npm run dev`.
6. Run `npm run build` to verify a production build.

## Deploy

Deploy this folder as the frontend root directory. Configure `VITE_API_URL` in the hosting provider's environment settings. A successful frontend build does not prove every backend endpoint exists; the admin API must provide the endpoints called by the pages.

## Notes

- `src/App.jsx` owns the single `BrowserRouter`; `src/main.jsx` must not wrap it in another router.
- Settings preferences and theme are stored in this browser. Password changes and email delivery require backend support.
- Parking Lots, Parking Slots, Drivers, Bookings, Payments, QR Tickets, and Vehicles are retained. Their full CRUD behaviour depends on the matching backend endpoints.
