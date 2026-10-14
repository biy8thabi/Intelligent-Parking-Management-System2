const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabaseClient');

const SALT_ROUNDS = 10;

function generateToken(id, role) {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// ------------------------------------------------------------
// POST /api/auth/register
// ------------------------------------------------------------
async function registerUser(req, res) {
  try {
    const { full_name, email, password, phone_number } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ error: 'full_name, email and password are required' });
    }

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const { data: newUser, error } = await supabase
      .from('users')
      .insert([{ full_name, email, password_hash, phone_number }])
      .select('id, full_name, email, phone_number, created_at')
      .single();

    if (error) throw error;

    const token = generateToken(newUser.id, 'user');
    res.status(201).json({ user: newUser, token });
  } catch (err) {
    console.error('registerUser error:', err.message);
    res.status(500).json({ error: 'Something went wrong while registering' });
  }
}

// ------------------------------------------------------------
// POST /api/auth/login
// ------------------------------------------------------------
async function loginUser(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, full_name, email, password_hash')
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user.id, 'user');
    res.json({
      user: { id: user.id, full_name: user.full_name, email: user.email },
      token,
    });
  } catch (err) {
    console.error('loginUser error:', err.message);
    res.status(500).json({ error: 'Something went wrong while logging in' });
  }
}

// ------------------------------------------------------------
// POST /api/auth/admin-login
// ------------------------------------------------------------
async function loginAdmin(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const { data: admin, error } = await supabase
      .from('admins')
      .select('id, full_name, email, password_hash, role')
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;
    if (!admin) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordMatches = await bcrypt.compare(password, admin.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(admin.id, 'admin');
    res.json({
      admin: { id: admin.id, full_name: admin.full_name, email: admin.email, role: admin.role },
      token,
    });
  } catch (err) {
    console.error('loginAdmin error:', err.message);
    res.status(500).json({ error: 'Something went wrong while logging in' });
  }
}

// ------------------------------------------------------------
// GET /api/auth/me  (requires auth)
// Returns the profile of whoever the token belongs to.
// Uses req.auth (set by the requireAuth middleware) rather than a
// param, so a driver can only ever fetch their OWN profile - never
// someone else's by guessing an id in the URL.
// ------------------------------------------------------------
async function getProfile(req, res) {
  try {
    const { id, role } = req.auth;

    // Admin tokens and user tokens point at different tables
    const table = role === 'admin' ? 'admins' : 'users';
    const columns = role === 'admin'
      ? 'id, full_name, email, role, created_at'
      : 'id, full_name, email, phone_number, created_at';

    const { data: profile, error } = await supabase
      .from(table)
      .select(columns)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({ [role === 'admin' ? 'admin' : 'user']: profile });
  } catch (err) {
    console.error('getProfile error:', err.message);
    res.status(500).json({ error: 'Could not fetch profile' });
  }
}

module.exports = { registerUser, loginUser, loginAdmin, getProfile };
