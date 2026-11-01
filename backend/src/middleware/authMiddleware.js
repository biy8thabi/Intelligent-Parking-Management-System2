const jwt = require('jsonwebtoken');

// Protects a route: the request must include a valid JWT in the
// Authorization header, in the form "Bearer <token>".
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided. Include Authorization: Bearer <token>' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.auth = decoded; // { id, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Like requireAuth, but only lets admins through.
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.auth.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access only' });
    }
    next();
  });
}

// Ownership check for routes with a user id in the URL, e.g.
// /history/:user_id. The logged-in user's id (from the token) must match
// the id in the URL, otherwise they're trying to read someone else's data.
// Admins are allowed through, since they manage the whole system.
function requireSelf(paramName = 'user_id') {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      if (req.auth.role === 'admin' || req.auth.id === req.params[paramName]) {
        return next();
      }
      return res.status(403).json({ error: 'You can only access your own data' });
    });
  };
}

// Helper for controllers: is the caller the owner of this record
// (or an admin)? Use after loading a record that has a user_id.
function isOwnerOrAdmin(req, ownerId) {
  return req.auth.role === 'admin' || req.auth.id === ownerId;
}

module.exports = { requireAuth, requireAdmin, requireSelf, isOwnerOrAdmin };
