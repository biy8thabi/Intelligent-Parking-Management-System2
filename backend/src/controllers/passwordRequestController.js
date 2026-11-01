const bcrypt = require('bcryptjs');
const supabase = require('../config/supabaseClient');
const { generateTempPassword } = require('../utils/validators');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SALT_ROUNDS = 10;

const REQUEST_COLUMNS =
  'id, user_id, email, status, created_at, handled_at, users:user_id ( full_name, phone_number )';

// ------------------------------------------------------------
// GET /api/admin/password-requests?status=pending
// status can be pending (default), done, dismissed or all
// ------------------------------------------------------------
async function listPasswordRequests(req, res) {
  try {
    const status = req.query.status || 'pending';
    if (!['pending', 'done', 'dismissed', 'all'].includes(status)) {
      return res.status(400).json({ error: 'status must be pending, done, dismissed or all' });
    }

    let query = supabase
      .from('password_reset_requests')
      .select(REQUEST_COLUMNS)
      .order('created_at', { ascending: false });

    if (status !== 'all') query = query.eq('status', status);

    const { data: requests, error } = await query;
    if (error) throw error;

    res.json({ requests });
  } catch (err) {
    console.error('listPasswordRequests error:', err.message);
    res.status(500).json({ error: 'Could not fetch password requests' });
  }
}

// Loads a request and checks it can still be handled.
// Returns { request } or { status, error } to send back.
async function loadPendingRequest(id) {
  if (!UUID_RE.test(id)) return { status: 400, error: 'Invalid request id' };

  const { data: request, error } = await supabase
    .from('password_reset_requests')
    .select('id, user_id, email, status')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!request) return { status: 404, error: 'Request not found' };
  if (request.status !== 'pending') {
    return { status: 409, error: 'This request has already been handled' };
  }
  return { request };
}

// ------------------------------------------------------------
// POST /api/admin/password-requests/:id/reset
// Sets a random temporary password for the driver and returns it
// ONCE, so the admin can pass it on. The driver should then change
// it with PUT /api/auth/change-password.
// ------------------------------------------------------------
async function resetFromRequest(req, res) {
  try {
    const loaded = await loadPendingRequest(req.params.id);
    if (loaded.error) return res.status(loaded.status).json({ error: loaded.error });
    const { request } = loaded;

    const temporary_password = generateTempPassword();
    const password_hash = await bcrypt.hash(temporary_password, SALT_ROUNDS);

    const { data: driver, error: userError } = await supabase
      .from('users')
      .update({ password_hash })
      .eq('id', request.user_id)
      .select('id, full_name, email')
      .single();

    if (userError) throw userError;

    const { error: requestError } = await supabase
      .from('password_reset_requests')
      .update({
        status: 'done',
        handled_at: new Date().toISOString(),
        handled_by: req.auth.id,
      })
      .eq('id', request.id);

    if (requestError) throw requestError;

    res.json({
      message: 'Password reset. Give the driver this temporary password and ask them to change it after logging in.',
      temporary_password,
      user: { id: driver.id, full_name: driver.full_name, email: driver.email },
    });
  } catch (err) {
    console.error('resetFromRequest error:', err.message);
    res.status(500).json({ error: 'Could not reset the password' });
  }
}

// ------------------------------------------------------------
// POST /api/admin/password-requests/:id/dismiss
// For requests that look wrong or duplicated. Leaves the password alone.
// ------------------------------------------------------------
async function dismissRequest(req, res) {
  try {
    const loaded = await loadPendingRequest(req.params.id);
    if (loaded.error) return res.status(loaded.status).json({ error: loaded.error });

    const { error } = await supabase
      .from('password_reset_requests')
      .update({
        status: 'dismissed',
        handled_at: new Date().toISOString(),
        handled_by: req.auth.id,
      })
      .eq('id', loaded.request.id);

    if (error) throw error;

    res.json({ message: 'Request dismissed', id: loaded.request.id });
  } catch (err) {
    console.error('dismissRequest error:', err.message);
    res.status(500).json({ error: 'Could not dismiss the request' });
  }
}

module.exports = { listPasswordRequests, resetFromRequest, dismissRequest };
