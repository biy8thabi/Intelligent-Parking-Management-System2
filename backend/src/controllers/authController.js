const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabaseClient');
const {
  validatePassword,
  validateFullName,
  validateSouthAfricanPhone,
} = require('../utils/validators');

const SALT_ROUNDS = 10;

function generateToken(id, role) {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// POST /api/auth/register

async function registerUser(req, res) {
  try {
    const { full_name, email, password, phone_number } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ error: 'full_name, email and password are required' });
    }

    const nameCheck = validateFullName(full_name);
    if (nameCheck.error) {
      return res.status(400).json({ error: nameCheck.error });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const phoneCheck = validateSouthAfricanPhone(phone_number);

if (phoneCheck.error) {
  return res.status(400).json({
    error: phoneCheck.error,
  });
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
      .insert([{
  full_name: nameCheck.name,
  email,
  password_hash,
  phone_number: phoneCheck.phone,
}])
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

// POST /api/auth/login

async function loginUser(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, full_name, email, phone_number, password_hash')
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
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone_number: user.phone_number,
      },
      token,
    });
  } catch (err) {
    console.error('loginUser error:', err.message);
    res.status(500).json({ error: 'Something went wrong while logging in' });
  }
}

// POST /api/auth/admin-login

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

// GET /api/auth/me  (requires auth)
// Returns the profile of whoever the token belongs to.

async function getProfile(req, res) {
  try {
    const { id, role } = req.auth;

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

// POST /api/auth/forgot-password   (public)
// Body: { email }
// Drivers have no email service to send a reset link, so this logs a request that an admin can see and act on. The reply is always the same, so nobody can use it to find out which emails are registered.

async function forgotPassword(req, res) {
  try {
    const { email } = req.body || {};

    if (!email || typeof email !== 'string' || email.trim() === '') {
      return res.status(400).json({ error: 'email is required' });
    }

    const reply = {
      message:
        'If an account with that email exists, an admin has been notified and will give you a temporary password.',
    };

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email.trim())
      .maybeSingle();

    if (error) throw error;
    if (!user) return res.json(reply);

    const { data: pending, error: pendingError } = await supabase
      .from('password_reset_requests')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (pendingError) throw pendingError;
    if (pending) return res.json(reply);

    const { error: insertError } = await supabase
      .from('password_reset_requests')
      .insert([{ user_id: user.id, email: user.email, status: 'pending' }]);

    // 23505 = another request for this driver was saved a moment ago. Fine.
    if (insertError && insertError.code !== '23505') throw insertError;

    res.json(reply);
  } catch (err) {
    console.error('forgotPassword error:', err.message);
    res.status(500).json({ error: 'Could not process the request' });
  }
}

// PUT /api/auth/change-password   (requires auth, drivers and admins)
// Body: { "current_password":"", "new_password":"" }

async function changePassword(req, res) {
  try {
    const { current_password, new_password } = req.body || {};

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'current_password and new_password are required' });
    }

    const passwordError = validatePassword(new_password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const { id, role } = req.auth;
    const table = role === 'admin' ? 'admins' : 'users';

    const { data: account, error } = await supabase
      .from(table)
      .select('id, password_hash')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const matches = await bcrypt.compare(current_password, account.password_hash);
    if (!matches) {
      // 400 rather than 401, so an app doesn't treat a typo as "logged out"
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    if (current_password === new_password) {
      return res.status(400).json({ error: 'New password must be different from the current one' });
    }

    const password_hash = await bcrypt.hash(new_password, SALT_ROUNDS);

    const { error: updateError } = await supabase
      .from(table)
      .update({ password_hash })
      .eq('id', id);

    if (updateError) throw updateError;

    res.json({ message: 'Password changed' });
  } catch (err) {
    console.error('changePassword error:', err.message);
    res.status(500).json({ error: 'Could not change password' });
  }
}

module.exports = {
  registerUser,
  loginUser,
  loginAdmin,
  getProfile,
  forgotPassword,
  changePassword,
};
