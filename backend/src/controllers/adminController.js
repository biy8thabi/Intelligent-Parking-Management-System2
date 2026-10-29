const supabase = require('../config/supabaseClient');
const { endSessionCore } = require('./parkingController');

// ------------------------------------------------------------
// GET /api/admin/sessions/active
// Lists every currently-active session, with the driver's name/email
// and vehicle reg attached, so an admin can spot ones that look stuck
// (e.g. a phone died and the driver never ended it themselves).
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// POST /api/admin/sessions/:id/force-end
// Lets an admin manually close a session that never got ended
// normally - e.g. the driver's phone switched off.
// ------------------------------------------------------------
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
    res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Could not force-end session' });
  }
}
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

module.exports = { getActiveSessions, forceEndSession, getAllUsers };
 
