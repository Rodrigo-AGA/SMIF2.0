const crypto = require('crypto');

// ---------- Protección de la API (responden JSON) ----------
exports.authMiddleware = (req, res, next) => {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ status: 'fail', message: 'Acceso no autorizado' });
};

exports.requireRole = (...roles) => (req, res, next) => {
  if (roles.includes(req.session.rol)) return next();
  return res.status(403).json({ status: 'fail', message: 'No tienes permisos para acceder a este recurso' });
};

// ---------- Protección de páginas HTML (redirigen) ----------
// Sin sesión -> login. Con sesión pero rol incorrecto -> a la página de su propio rol.
exports.pageGuard = (...roles) => (req, res, next) => {
  res.set('Cache-Control', 'no-store');   // evita ver la página con el botón "atrás" tras cerrar sesión
  if (!req.session || !req.session.userId) return res.redirect('/login.html');
  if (roles.length && !roles.includes(req.session.rol)) {
    return res.redirect(req.session.rol === 'docente' ? '/docente.html' : '/alumno.html');
  }
  next();
};

// Comparación en tiempo constante de la cabecera x-admin-key con ADMIN_KEY
exports.adminKeyOk = (req) => {
  const expected = Buffer.from(process.env.ADMIN_KEY || '');
  const provided = Buffer.from(req.get('x-admin-key') || '');
  return expected.length > 0 &&
         expected.length === provided.length &&
         crypto.timingSafeEqual(expected, provided);
};

exports.requireAdminKey = (req, res, next) => {
  if (!exports.adminKeyOk(req)) return res.status(403).json({ status: 'fail', message: 'No autorizado' });
  next();
};
