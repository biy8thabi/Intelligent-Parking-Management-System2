const supabase = require('../config/supabaseClient');
const { createNotification } = require('./notificationController');
const { isOwnerOrAdmin } = require('../middleware/authMiddleware');

// ------------------------------------------------------------
// GET /api/parking/availability
// ------------------------------------------------------------
async function getAvailability(req, res) {
  try {
    const { data: spaces, error } = await supabase
      .from('parking_spaces')
      .select('id, zone, bay_number, floor, gate, status, is_accessible');

    if (error) throw error;

    const available = spaces.filter((s) => s.status === 'available');
    const occupied = spaces.filter((s) => s.status === 'occupied');
    // "disabled" means a bay an admin has switched off (out of service).
    // It is NOT the same as an accessible bay - that is the is_accessible flag.
    const disabled = spaces.filter((s) => s.status === 'disabled');

    res.json({
      total_spaces: spaces.length,
      available_count: available.length,
      occupied_count: occupied.length,
      disabled_count: disabled.length,
      accessible_available_count: available.filter((s) => s.is_accessible).length,
      available_spaces: available,
    });
  } catch (err) {
    console.error('getAvailability error:', err.message);
    res.status(500).json({ error: 'Could not fetch parking availability' });
  }
}

// ------------------------------------------------------------
// POST /api/parking/session/start
// The user_id in the body must match the logged-in driver, so a
// driver can't start sessions on someone else's account.
// ------------------------------------------------------------
async function createSession(req, res) {
  try {
    const { user_id, parking_space_id, vehicle_registration_number } = req.body;

    if (!user_id || !parking_space_id || !vehicle_registration_number) {
      return res.status(400).json({
        error: 'user_id, parking_space_id and vehicle_registration_number are required',
      });
    }

    if (!isOwnerOrAdmin(req, user_id)) {
      return res.status(403).json({ error: 'You can only start sessions for your own account' });
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
      .insert([{
        user_id,
        parking_space_id,
        vehicle_registration_number,
        session_status: 'active',
      }])
      .select()
      .single();

    if (sessionError) throw sessionError;

    const { error: updateError } = await supabase
      .from('parking_spaces')
      .update({ status: 'occupied', updated_at: new Date().toISOString() })
      .eq('id', parking_space_id);

    if (updateError) throw updateError;

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
// GET /api/parking/session/active/:user_id
// (route-level requireSelf already confirms the caller owns :user_id)
// ------------------------------------------------------------
async function getActiveSessionForUser(req, res) {
  try {
    const { user_id } = req.params;

    const { data: session, error } = await supabase
      .from('parking_sessions')
      .select('*, parking_spaces:parking_space_id ( zone, bay_number, floor, gate, is_accessible )')
      .eq('user_id', user_id)
      .eq('session_status', 'active')
      .maybeSingle();

    if (error) throw error;

    res.json({ active_session: session || null });
  } catch (err) {
    console.error('getActiveSessionForUser error:', err.message);
    res.status(500).json({ error: 'Could not fetch active session' });
  }
}

// ------------------------------------------------------------
// GET /api/parking/history/:user_id
// ------------------------------------------------------------
async function getSessionHistory(req, res) {
  try {
    const { user_id } = req.params;

    const { data: sessions, error } = await supabase
      .from('parking_sessions')
      .select('*, parking_spaces:parking_space_id ( zone, bay_number, floor, gate, is_accessible )')
      .eq('user_id', user_id)
      .eq('session_status', 'completed')
      .order('exit_time', { ascending: false });

    if (error) throw error;

    res.json({ history: sessions });
  } catch (err) {
    console.error('getSessionHistory error:', err.message);
    res.status(500).json({ error: 'Could not fetch parking history' });
  }
}

// ------------------------------------------------------------
// Shared core logic for ending a session. Used by the driver's
// endSession and the admin force-end.
//
// requesterId: when set, the session must belong to that user,
// otherwise a 403 is thrown. The admin force-end leaves it unset.
// ------------------------------------------------------------
async function endSessionCore(
  session_id,
  notifyMessagePrefix = 'Your parking session has ended.',
  requesterId = null
) {
  const { data: session, error: fetchError } = await supabase
    .from('parking_sessions')
    .select('id, user_id, parking_space_id, entry_time, session_status')
    .eq('id', session_id)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!session) {
    const err = new Error('Session not found');
    err.statusCode = 404;
    throw err;
  }
  if (requesterId && session.user_id !== requesterId) {
    const err = new Error('You can only end your own sessions');
    err.statusCode = 403;
    throw err;
  }
  if (session.session_status === 'completed') {
    const err = new Error('This session has already ended');
    err.statusCode = 409;
    throw err;
  }
  if (session.session_status === 'cancelled') {
    const err = new Error('This session was cancelled');
    err.statusCode = 409;
    throw err;
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
      `${notifyMessagePrefix} Fee: R${feeAmount}.`,
      'session_ended'
    );
  } catch (notifyErr) {
    console.error('Notification failed (non-blocking):', notifyErr.message);
  }

  return updatedSession;
}

// ------------------------------------------------------------
// POST /api/parking/session/end
// ------------------------------------------------------------
async function endSession(req, res) {
  try {
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({ error: 'session_id is required' });
    }

    // Drivers can only end their own sessions; admins can end any.
    const requesterId = req.auth.role === 'admin' ? null : req.auth.id;
    const updatedSession = await endSessionCore(
      session_id,
      'Your parking session has ended.',
      requesterId
    );
    res.json({ session: updatedSession });
  } catch (err) {
    console.error('endSession error:', err.message);
    res.status(err.statusCode || 500).json({
      error: err.statusCode ? err.message : 'Could not end parking session',
    });
  }
}

// ------------------------------------------------------------
// POST /api/parking/session/cancel
// Body: { session_id }
// Free cancellation for a session the driver never actually used.
// Only allowed within CANCEL_WINDOW_MINUTES of the session starting;
// after that the driver has to end the session normally and pay the fee.
// (Without a window, anyone could dodge the fee by "cancelling" at exit.)
// ------------------------------------------------------------
const CANCEL_WINDOW_MINUTES = 5;

async function cancelSession(req, res) {
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
    if (!isOwnerOrAdmin(req, session.user_id)) {
      return res.status(403).json({ error: 'You can only cancel your own sessions' });
    }
    if (session.session_status !== 'active') {
      return res.status(409).json({ error: 'Only an active session can be cancelled' });
    }

    const minutesSinceStart = (Date.now() - new Date(session.entry_time).getTime()) / 60000;
    if (minutesSinceStart > CANCEL_WINDOW_MINUTES) {
      return res.status(409).json({
        error: `The free cancellation window (${CANCEL_WINDOW_MINUTES} minutes) has passed. End the session instead to pay the fee.`,
      });
    }

    const { data: cancelled, error: updateError } = await supabase
      .from('parking_sessions')
      .update({
        session_status: 'cancelled',
        exit_time: new Date().toISOString(),
        fee_amount: 0,
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
        'Your parking session was cancelled. No fee was charged.',
        'session_cancelled'
      );
    } catch (notifyErr) {
      console.error('Notification failed (non-blocking):', notifyErr.message);
    }

    res.json({ session: cancelled });
  } catch (err) {
    console.error('cancelSession error:', err.message);
    res.status(500).json({ error: 'Could not cancel parking session' });
  }
}

module.exports = {
  getAvailability,
  createSession,
  endSession,
  endSessionCore,
  cancelSession,
  getActiveSessionForUser,
  getSessionHistory,
};
