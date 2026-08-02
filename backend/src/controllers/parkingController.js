const supabase = require('../config/supabaseClient');

// ------------------------------------------------------------
// GET /api/parking/availability
// Returns how many spaces are available/occupied/disabled,
// plus the list of currently available spaces.
// ------------------------------------------------------------
async function getAvailability(req, res) {
  try {
    const { data: spaces, error } = await supabase
      .from('parking_spaces')
      .select('id, zone, bay_number, status');

    if (error) throw error;

    const available = spaces.filter((s) => s.status === 'available');
    const occupied = spaces.filter((s) => s.status === 'occupied');
    const disabled = spaces.filter((s) => s.status === 'disabled');

    res.json({
      total_spaces: spaces.length,
      available_count: available.length,
      occupied_count: occupied.length,
      disabled_count: disabled.length,
      available_spaces: available,
    });
  } catch (err) {
    console.error('getAvailability error:', err.message);
    res.status(500).json({ error: 'Could not fetch parking availability' });
  }
}

// ------------------------------------------------------------
// POST /api/parking/session/start
// Body: { user_id, parking_space_id }
// Creates a session and marks the space as occupied.
// ------------------------------------------------------------
async function createSession(req, res) {
  try {
    const { user_id, parking_space_id } = req.body;

    if (!user_id || !parking_space_id) {
      return res.status(400).json({ error: 'user_id and parking_space_id are required' });
    }

    // Confirm the space exists and is actually available before booking it
    const { data: space, error: spaceError } = await supabase
      .from('parking_spaces')
      .select('id, status')
      .eq('id', parking_space_id)
      .maybeSingle();

    if (spaceError) throw spaceError;
    if (!space) {
      return res.status(404).json({ error: 'Parking space not found' });
    }
    if (space.status !== 'available') {
      return res.status(409).json({ error: 'This parking space is not available' });
    }

    const { data: session, error: sessionError } = await supabase
      .from('parking_sessions')
      .insert([{ user_id, parking_space_id, session_status: 'active' }])
      .select()
      .single();

    if (sessionError) throw sessionError;

    // Mark the space as occupied now that a session has started
    const { error: updateError } = await supabase
      .from('parking_spaces')
      .update({ status: 'occupied', updated_at: new Date().toISOString() })
      .eq('id', parking_space_id);

    if (updateError) throw updateError;

    res.status(201).json({ session });
  } catch (err) {
    console.error('createSession error:', err.message);
    res.status(500).json({ error: 'Could not start parking session' });
  }
}

// ------------------------------------------------------------
// POST /api/parking/session/end
// Body: { session_id }
// Closes the session, frees up the space, and calculates a fee.
// ------------------------------------------------------------
async function endSession(req, res) {
  try {
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({ error: 'session_id is required' });
    }

    const { data: session, error: fetchError } = await supabase
      .from('parking_sessions')
      .select('id, parking_space_id, entry_time, session_status')
      .eq('id', session_id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (session.session_status === 'completed') {
      return res.status(409).json({ error: 'This session has already ended' });
    }

    const exitTime = new Date();
    const entryTime = new Date(session.entry_time);
    const minutesParked = Math.max(1, Math.round((exitTime - entryTime) / 60000));

    // Simple flat rate example - swap in your team's actual pricing logic
    const RATE_PER_HOUR = 10;
    const feeAmount = Math.round((minutesParked / 60) * RATE_PER_HOUR * 100) / 100;

    const { data: updatedSession, error: updateError } = await supabase
      .from('parking_sessions')
      .update({
        exit_time: exitTime.toISOString(),
        session_status: 'completed',
        fee_amount: feeAmount,
      })
      .eq('id', session_id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Free up the parking space again
    const { error: spaceError } = await supabase
      .from('parking_spaces')
      .update({ status: 'available', updated_at: new Date().toISOString() })
      .eq('id', session.parking_space_id);

    if (spaceError) throw spaceError;

    res.json({ session: updatedSession });
  } catch (err) {
    console.error('endSession error:', err.message);
    res.status(500).json({ error: 'Could not end parking session' });
  }
}

module.exports = { getAvailability, createSession, endSession };
