const crypto = require('crypto');
const QRCode = require('qrcode');
const supabase = require('../config/supabaseClient');
const { isOwnerOrAdmin } = require('../middleware/authMiddleware');

function generateTicketCode() {
  const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `TCK-${randomPart}`;
}

// ------------------------------------------------------------
// POST /api/tickets/generate
// Body: { session_id }
// The session must belong to the logged-in driver (or caller is admin).
// ------------------------------------------------------------
async function generateTicket(req, res) {
  try {
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({ error: 'session_id is required' });
    }

    const { data: session, error: sessionError } = await supabase
      .from('parking_sessions')
      .select('id, user_id')
      .eq('id', session_id)
      .maybeSingle();

    if (sessionError) throw sessionError;
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (!isOwnerOrAdmin(req, session.user_id)) {
      return res.status(403).json({ error: 'You can only generate tickets for your own sessions' });
    }

    const ticket_code = generateTicketCode();
    const qr_code_url = await QRCode.toDataURL(ticket_code);

    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert([{ session_id, ticket_code, qr_code_url }])
      .select()
      .single();

    if (ticketError) throw ticketError;

    res.status(201).json({ ticket });
  } catch (err) {
    console.error('generateTicket error:', err.message);
    res.status(500).json({ error: 'Could not generate ticket' });
  }
}

// ------------------------------------------------------------
// GET /api/tickets/:session_id
// Same ownership rule: only the session's owner (or an admin).
// ------------------------------------------------------------
async function getTicketBySession(req, res) {
  try {
    const { session_id } = req.params;

    const { data: session, error: sessionError } = await supabase
      .from('parking_sessions')
      .select('id, user_id')
      .eq('id', session_id)
      .maybeSingle();

    if (sessionError) throw sessionError;
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (!isOwnerOrAdmin(req, session.user_id)) {
      return res.status(403).json({ error: 'You can only view tickets for your own sessions' });
    }

    const { data: ticket, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('session_id', session_id)
      .maybeSingle();

    if (error) throw error;
    if (!ticket) {
      return res.status(404).json({ error: 'No ticket found for this session' });
    }

    res.json({ ticket });
  } catch (err) {
    console.error('getTicketBySession error:', err.message);
    res.status(500).json({ error: 'Could not fetch ticket' });
  }
}

module.exports = { generateTicket, getTicketBySession };
