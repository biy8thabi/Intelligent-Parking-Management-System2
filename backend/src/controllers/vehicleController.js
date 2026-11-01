const supabase = require('../config/supabaseClient');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Every response returns the vehicle plus its owner's name and email
// (owner is null when the vehicle is not linked to a driver).
const VEHICLE_COLUMNS =
  'id, registration_number, make, model, color, user_id, created_at, updated_at, users:user_id ( full_name, email )';

// "ca 123-456" and "CA123-456" should count as the same plate,
// so registration numbers are stored in upper case with no spaces.
function normalizeReg(value) {
  return String(value).replace(/\s+/g, '').toUpperCase();
}

// Optional text fields: trim them, and treat empty/null as "not set".
function cleanText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

// Returns an error message if the registration number is unusable.
function checkReg(value) {
  if (value === undefined || value === null || normalizeReg(value) === '') {
    return 'registration_number is required';
  }
  if (typeof value !== 'string') {
    return 'registration_number must be text';
  }
  if (normalizeReg(value).length > 20) {
    return 'registration_number is too long (max 20 characters)';
  }
  return null;
}

// Returns null when the driver exists, otherwise a { status, error } to send back.
async function checkDriver(user_id) {
  if (!UUID_RE.test(String(user_id))) {
    return { status: 400, error: 'user_id is not a valid id' };
  }
  const { data: driver, error } = await supabase
    .from('users')
    .select('id')
    .eq('id', user_id)
    .maybeSingle();
  if (error) throw error;
  if (!driver) return { status: 404, error: 'Driver not found' };
  return null;
}

// ------------------------------------------------------------
// GET /api/admin/vehicles
// ------------------------------------------------------------
async function listVehicles(req, res) {
  try {
    const { data: vehicles, error } = await supabase
      .from('vehicles')
      .select(VEHICLE_COLUMNS)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ vehicles });
  } catch (err) {
    console.error('listVehicles error:', err.message);
    res.status(500).json({ error: 'Could not fetch vehicles' });
  }
}

// ------------------------------------------------------------
// POST /api/admin/vehicles
// Body: { registration_number, make?, model?, color?, user_id? }
// ------------------------------------------------------------
async function createVehicle(req, res) {
  try {
    const { registration_number, make, model, color, user_id } = req.body || {};

    const regError = checkReg(registration_number);
    if (regError) return res.status(400).json({ error: regError });

    if (user_id !== undefined && user_id !== null) {
      const driverProblem = await checkDriver(user_id);
      if (driverProblem) {
        return res.status(driverProblem.status).json({ error: driverProblem.error });
      }
    }

    const reg = normalizeReg(registration_number);

    const { data: existing, error: dupError } = await supabase
      .from('vehicles')
      .select('id')
      .eq('registration_number', reg)
      .maybeSingle();
    if (dupError) throw dupError;
    if (existing) {
      return res.status(409).json({ error: 'A vehicle with this registration number already exists' });
    }

    const { data: vehicle, error } = await supabase
      .from('vehicles')
      .insert([{
        registration_number: reg,
        make: cleanText(make),
        model: cleanText(model),
        color: cleanText(color),
        user_id: user_id || null,
      }])
      .select(VEHICLE_COLUMNS)
      .single();

    if (error) {
      // Two admins registering the same plate at the same moment
      if (error.code === '23505') {
        return res.status(409).json({ error: 'A vehicle with this registration number already exists' });
      }
      throw error;
    }

    res.status(201).json({ vehicle });
  } catch (err) {
    console.error('createVehicle error:', err.message);
    res.status(500).json({ error: 'Could not register vehicle' });
  }
}

// ------------------------------------------------------------
// PUT /api/admin/vehicles/:id
// Send only the fields you want to change. Send user_id as null
// to unlink the vehicle from its driver.
// ------------------------------------------------------------
async function updateVehicle(req, res) {
  try {
    const { id } = req.params;
    if (!UUID_RE.test(id)) {
      return res.status(400).json({ error: 'Invalid vehicle id' });
    }

    const { data: current, error: fetchError } = await supabase
      .from('vehicles')
      .select('id, registration_number')
      .eq('id', id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!current) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const body = req.body || {};
    const updates = {};

    if ('registration_number' in body) {
      const regError = checkReg(body.registration_number);
      if (regError) return res.status(400).json({ error: regError });
      updates.registration_number = normalizeReg(body.registration_number);
    }
    if ('make' in body) updates.make = cleanText(body.make);
    if ('model' in body) updates.model = cleanText(body.model);
    if ('color' in body) updates.color = cleanText(body.color);

    if ('user_id' in body) {
      if (body.user_id === null) {
        updates.user_id = null;
      } else {
        const driverProblem = await checkDriver(body.user_id);
        if (driverProblem) {
          return res.status(driverProblem.status).json({ error: driverProblem.error });
        }
        updates.user_id = body.user_id;
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    if (updates.registration_number && updates.registration_number !== current.registration_number) {
      const { data: clash, error: clashError } = await supabase
        .from('vehicles')
        .select('id')
        .eq('registration_number', updates.registration_number)
        .neq('id', id)
        .maybeSingle();
      if (clashError) throw clashError;
      if (clash) {
        return res.status(409).json({ error: 'Another vehicle already has this registration number' });
      }
    }

    updates.updated_at = new Date().toISOString();

    const { data: vehicle, error } = await supabase
      .from('vehicles')
      .update(updates)
      .eq('id', id)
      .select(VEHICLE_COLUMNS)
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Another vehicle already has this registration number' });
      }
      throw error;
    }

    res.json({ vehicle });
  } catch (err) {
    console.error('updateVehicle error:', err.message);
    res.status(500).json({ error: 'Could not update vehicle' });
  }
}

// ------------------------------------------------------------
// DELETE /api/admin/vehicles/:id
// ------------------------------------------------------------
async function deleteVehicle(req, res) {
  try {
    const { id } = req.params;
    if (!UUID_RE.test(id)) {
      return res.status(400).json({ error: 'Invalid vehicle id' });
    }

    const { data: existing, error: fetchError } = await supabase
      .from('vehicles')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const { error } = await supabase.from('vehicles').delete().eq('id', id);
    if (error) throw error;

    res.json({ message: 'Vehicle deleted', id });
  } catch (err) {
    console.error('deleteVehicle error:', err.message);
    res.status(500).json({ error: 'Could not delete vehicle' });
  }
}

module.exports = { listVehicles, createVehicle, updateVehicle, deleteVehicle };
