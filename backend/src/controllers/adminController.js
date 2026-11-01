const supabase = require('../config/supabaseClient');
const { endSessionCore } = require('./parkingController');

// GET /api/admin/sessions/active

async function getActiveSessions(req, res) {
  try {
    const { data: sessions, error } = await supabase
      .from('parking_sessions')
      .select(`
        id,
        entry_time,
        vehicle_registration_number,
        parking_space_id,
        users:user_id ( full_name, email ),
        parking_spaces:parking_space_id ( zone, bay_number )
      `)
      .eq('session_status', 'active')
      .order('entry_time', { ascending: true });

    if (error) throw error;
    res.json({ active_sessions: sessions });
  } catch (err) {
    console.error('getActiveSessions error:', err.message);
    res.status(500).json({ error: 'Could not fetch active sessions' });
  }
}

// POST /api/admin/sessions/:id/force-end

async function forceEndSession(req, res) {
  try {
    const { id } = req.params;
    const updatedSession = await endSessionCore(
      id,
      'Your parking session was ended by an admin.'
    );
    res.json({ session: updatedSession });
  } catch (err) {
    console.error('forceEndSession error:', err.message);
    res.status(err.statusCode || 500).json({
      error: err.statusCode ? err.message : 'Could not force-end session'
    });
  }
}

// GET /api/admin/users

async function getAllUsers(req, res) {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, full_name, email, phone_number, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ users });
  } catch (err) {
    console.error('getAllUsers error:', err.message);
    res.status(500).json({ error: 'Could not fetch users' });
  }
}

// ------------------------------------------------------------
// GET /api/admin/sessions
// Every session (active, completed, cancelled), newest first.
// ------------------------------------------------------------
async function getAllSessions(req, res) {
  try {
    const { data: sessions, error } = await supabase
      .from('parking_sessions')
      .select(`
        id,
        entry_time,
        exit_time,
        vehicle_registration_number,
        fee_amount,
        payment_status,
        session_status,
        created_at,
        users:user_id ( full_name, email ),
        parking_spaces:parking_space_id ( zone, bay_number )
      `)
      .order('entry_time', { ascending: false })
      .limit(5000);

    if (error) throw error;
    res.json({ sessions });
  } catch (err) {
    console.error('getAllSessions error:', err.message);
    res.status(500).json({ error: 'Could not fetch sessions' });
  }
}

// GET /api/admin/parking-spaces
// Every bay with its current status.

async function getAllParkingSpaces(req, res) {
  try {
    const { data: parking_spaces, error } = await supabase
      .from('parking_spaces')
      .select('id, zone, bay_number, floor, gate, status, is_accessible, updated_at')
      .order('zone', { ascending: true })
      .order('bay_number', { ascending: true });

    if (error) throw error;
    res.json({ parking_spaces });
  } catch (err) {
    console.error('getAllParkingSpaces error:', err.message);
    res.status(500).json({ error: 'Could not fetch parking spaces' });
  }
}

// GET /api/admin/tickets
// Every ticket with its session's vehicle and bay.
// qr_code_url excluded to keep the list payload small.

async function getAllTickets(req, res) {
  try {
    const { data: tickets, error } = await supabase
      .from('tickets')
      .select(`
        id,
        ticket_code,
        issued_at,
        session_id,
        parking_sessions:session_id (
          vehicle_registration_number,
          session_status,
          parking_spaces:parking_space_id ( zone, bay_number )
        )
      `)
      .order('issued_at', { ascending: false })
      .limit(5000);

    if (error) throw error;
    res.json({ tickets });
  } catch (err) {
    console.error('getAllTickets error:', err.message);
    res.status(500).json({ error: 'Could not fetch tickets' });
  }
}

module.exports = {
  getActiveSessions,
  forceEndSession,
  getAllUsers,
  getAllSessions,
  getAllParkingSpaces,
  getAllTickets,
};