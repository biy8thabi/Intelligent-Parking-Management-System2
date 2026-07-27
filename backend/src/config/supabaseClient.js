const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;

// Use the service role key on the backend only — it bypasses Row Level
// Security, which is what a trusted server needs to do. NEVER expose the
// service role key to the mobile app or web frontend; those use the anon key.
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Check your .env file.'
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

module.exports = supabase;
