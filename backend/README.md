# IPMS Backend (Developer 1 - Backend & Database)

This is my part of the Intelligent Parking Management System project - the backend server and database setup.

## How to run this

1. **Install dependencies**
on the termnal type ## npm install
2. **Set up Supabase**
   - Create a free project at supabase.com
   - Open the SQL Editor and run `schema.sql` from this folder
   - This creates all 6 tables: users, admins, parking_spaces, parking_sessions, tickets, notifications

3. **Add your environment variables**
   - Copy `.env.example` and rename it to `.env`
   - Fill in your own Supabase Project URL and service_role key (find these under Settings > API or Settings > Data API in Supabase)
   - Set any random string for JWT_SECRET

4. **Run the server**
on the terminal type ## npm run dev
Then check `localhost:5000` in your browser - you should see a status message confirming it's running.

## Folder structure
backend/
├── schema.sql # database tables - (run this in Supabase)
├── .env.example # copy to .env and fill in your own values
├── package.json
└── src/
├── server.js # main server file
├── config/
│ └── supabaseClient.js # connects to Supabase
├── routes/ # API routes (coming in Week 2)
├── controllers/ # route logic (coming in Week 2)
└── middleware/ # auth checks etc (coming in Week 3)

## Notes to self / team

- The backend uses Supabase's service_role key instead of the anon key, since it needs full access to the database. Don't use this key anywhere in the mobile app or web frontend - only here on the server.
- `.env` is gitignored on purpose since it holds real credentials - never commit it.
- `parking_spaces.status` and `parking_sessions.session_status` only accept specific values (enforced at the database level) so bad data can't get inserted by mistake.