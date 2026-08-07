const supabase = require('../config/supabaseClient');
const { createNotification } = require('./notificationController');

// ------------------------------------------------------------
// GET /api/parking/availability
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
// ------------------------------------------------------------
async function createSession(req, res) {
  try {
    const { user_id, parking_space_id } = req.body;

    if (!user_id || !parking_space_id) {
      return res.status(400).json({ error: 'user_id and parking_space_id are required' });
    }

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

    const { error: updateError } = await supabase
      .from('parking_spaces')
      .update({ status: 'occupied', updated_at: new Date().toISOString() })
      .eq('id', parking_space_id);

    if (updateError) throw updateError;

    // Let the driver know their session has started.
    // Wrapped so that a notification failure never breaks the actual booking.
    try {
      await createNotification(
        user_id,
        `Your parking session has started at bay ${parking_space_id}.`,
        'session_started'
      );
    } catch (notifyErr) {
      console.error('Notification failed (non-blocking):', notifyErr.message);
    }

    res.status(201).json({ session });
  } catch (err) {
    console.error('createSession error:', err.message);
    res.status(500).json({ error: 'Could not start parking session' });
  }
}

// ------------------------------------------------------------
// POST /api/parking/session/end
// Body: { session_id }
// ------------------------------------------------------------
async function endSession(req, res) {
  try {
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({ error: 'session_id is required' });
    }

    const { data: session, error: fetchError } = await supabase
      .from('parking_sessions')
      .select('id, user_id, parking_space_id, entry_time, session_status')
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

    const { error: spaceError } = await supabase
      .from('parking_spaces')
      .update({ status: 'available', updated_at: new Date().toISOString() })
      .eq('id', session.parking_space_id);

    if (spaceError) throw spaceError;

    try {
      await createNotification(
        session.user_id,
        `Your parking session has ended. Fee: R${feeAmount}.`,
        'session_ended'
      );
    } catch (notifyErr) {
      console.error('Notification failed (non-blocking):', notifyErr.message);
    }

    res.json({ session: updatedSession });
  } catch (err) {
    console.error('endSession error:', err.message);
    res.status(500).json({ error: 'Could not end parking session' });
  }
}

module.exports = { getAvailability, createSession, endSession };
