const jwt = require('jsonwebtoken');

// Protects a route: the request must include a valid JWT in the
// Authorization header, in the form "Bearer <token>". Without this,
// anyone could call your APIs without logging in first.
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided. Include Authorization: Bearer <token>' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Attach the decoded info (id, role) to the request so later
    // route handlers know who's calling and whether they're a user or admin.
    req.auth = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Like requireAuth, but only lets admins through. Use this on
// admin-only routes (e.g. reports, managing parking spaces).
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.auth.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access only' });
    }
    next();
  });
}

module.exports = { requireAuth, requireAdmin };
