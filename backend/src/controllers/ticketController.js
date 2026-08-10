const crypto = require('crypto');
const QRCode = require('qrcode');
const supabase = require('../config/supabaseClient');

// Creates a short, unique, human-readable ticket code, e.g. "TCK-9F3A2B1C"
// This is what gets encoded into the QR image and can also be typed in
// manually if a QR scanner isn't available.
function generateTicketCode() {
  const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `TCK-${randomPart}`;
}

// ------------------------------------------------------------
// POST /api/tickets/generate
// Body: { session_id }
// Creates a ticket for an existing parking session, with a QR code
// image (as a base64 data URL) that the driver app can display.
// ------------------------------------------------------------
async function generateTicket(req, res) {
  try {
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({ error: 'session_id is required' });
    }

    // Confirm the session actually exists first
    const { data: session, error: sessionError } = await supabase
      .from('parking_sessions')
      .select('id')
      .eq('id', session_id)
      .maybeSingle();

    if (sessionError) throw sessionError;
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const ticket_code = generateTicketCode();

    // Encode the ticket code into a scannable QR image.
    // This returns a base64 data URL your frontend can drop straight
    // into an <img> tag - no separate image file needed.
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
// Fetches the ticket for a given session (e.g. to redisplay it later).
// ------------------------------------------------------------
async function getTicketBySession(req, res) {
  try {
    const { session_id } = req.params;

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
