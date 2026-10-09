const jwt = require('jsonwebtoken');

const normalizeRole = (role) => {
  const normalized = String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const roleAliases = {
    'gestor_de_productos': 'gestor',
    'super_admin': 'super_admin',
  };

  return roleAliases[normalized] || normalized;
};

const verifyToken = (req, res, next) => {
  const authorization = req.get('Authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return res.status(401).json({ message: 'Se requiere un token Bearer.' });
  }

  try {
    const payload = jwt.verify(match[1], process.env.JWT_SECRET);
    if (!payload.sub || !payload.role) {
      return res.status(401).json({ message: 'El token no contiene una identidad válida.' });
    }

    req.user = { id: payload.sub, role: payload.role, version: payload.version || 0 };
    return next();
  } catch {
    return res.status(401).json({ message: 'Token inválido o expirado.' });
  }
};

const verifyRole = (allowedRoles) => (req, res, next) => {
  const role = normalizeRole(req.user?.role);
  const allowed = allowedRoles.some((allowedRole) => normalizeRole(allowedRole) === role);

  if (!allowed) {
    return res.status(403).json({ message: 'No tienes permisos para realizar esta acción.' });
  }

  return next();
};

module.exports = { normalizeRole, verifyToken, verifyRole };
