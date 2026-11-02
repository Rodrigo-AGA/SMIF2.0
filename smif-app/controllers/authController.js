const bcrypt = require('bcryptjs');
const store = require('../data/userStore');
const limiter = require('../utils/loginLimiter');
const { COOKIE_NAME, ROLES, MODALIDADES } = require('../config/constants');
const { adminKeyOk } = require('../middleware/authMiddleware');

const DNI_RE = /^\d{8}$/;
const CELULAR_RE = /^9\d{8}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FAIL_MSG = 'DNI o contraseña incorrectos';

const DUMMY_HASH = bcrypt.hashSync('contraseña-ficticia', 10);

const texto = (v, max = 80) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max;
const passwordSegura = (p) => typeof p === 'string' && p.length >= 8 && p.length <= 72 && /[A-Za-z]/.test(p) && /\d/.test(p);

exports.register = async (req, res) => {
  try {
    const b = req.body || {};
    const fail = (message, status = 400) => res.status(status).json({ status: 'fail', message });

    if (!ROLES.includes(b.rol)) return fail('El rol debe ser "alumno" o "docente"');

    // Los profesores solo los registra la secretaría (clave en x-admin-key).
    if (b.rol === 'docente') {
      const key = `admin:${req.ip}`;
      if (limiter.blockedFor(key) > 0) return fail('Demasiados intentos. Intenta más tarde', 429);
      if (!adminKeyOk(req)) {
        limiter.fail(key);
        return fail('Clave de secretaría incorrecta: no puedes registrar profesores', 403);
      }
      limiter.reset(key);
    }
    if (!texto(b.nombre) || !texto(b.apellidos)) return fail('Nombres y apellidos son obligatorios');
    if (typeof b.dni !== 'string' || !DNI_RE.test(b.dni)) return fail('El DNI debe tener 8 dígitos');
    if (typeof b.email !== 'string' || !EMAIL_RE.test(b.email.trim())) return fail('Correo electrónico inválido');
    if (typeof b.celular !== 'string' || !CELULAR_RE.test(b.celular)) return fail('El celular debe tener 9 dígitos y empezar con 9');
    if (!passwordSegura(b.password)) return fail('La contraseña debe tener entre 8 y 72 caracteres, con letras y números');

    if (b.rol === 'alumno') {
      if (!texto(b.ciclo, 30)) return fail('El ciclo es obligatorio para alumnos');
      if (!MODALIDADES.includes(b.modalidad)) return fail('Modalidad inválida (presencial, virtual o híbrida)');
    } else if (!texto(b.especialidad)) {
      return fail('La especialidad es obligatoria para docentes');
    }

    const email = b.email.trim().toLowerCase();
    if (await store.findByDni(b.dni)) return fail('Ya existe un usuario con ese DNI', 409);
    if (await store.findByEmail(email)) return fail('Ya existe un usuario con ese correo', 409);

    const password = await bcrypt.hash(b.password, 10);
    const user = await store.add({
      rol: b.rol,
      nombre: b.nombre.trim(),
      apellidos: b.apellidos.trim(),
      dni: b.dni,
      email,
      celular: b.celular,
      password,
      ciclo: b.rol === 'alumno' ? b.ciclo.trim() : undefined,
      modalidad: b.rol === 'alumno' ? b.modalidad : undefined,
      especialidad: b.rol === 'docente' ? b.especialidad.trim() : undefined
    });

    return res.status(201).json({
      status: 'success',
      message: 'Usuario registrado correctamente',
      data: store.publicUser(user)
    });
  } catch (error) {
    // 23505: violación de UNIQUE (carrera entre la verificación y el INSERT)
    if (error.code === '23505') {
      return res.status(409).json({ status: 'fail', message: 'Ya existe un usuario con ese DNI o correo' });
    }
    console.error('Error en registro:', error);
    return res.status(500).json({ status: 'fail', message: 'Error interno del servidor' });
  }
};

exports.login = async (req, res) => {
  try {
    const { rol, dni, password } = req.body || {};
    if (!ROLES.includes(rol) || typeof dni !== 'string' || !DNI_RE.test(dni) ||
        typeof password !== 'string' || !password || password.length > 72) {
      return res.status(400).json({
        status: 'fail',
        message: 'Perfil, DNI (8 dígitos) y contraseña son obligatorios'
      });
    }
    const key = `${req.ip}:${dni}`;
    const espera = limiter.blockedFor(key);
    if (espera > 0) {
      return res.status(429).json({
        status: 'fail',
        message: `Demasiados intentos fallidos. Intenta de nuevo en ${Math.ceil(espera / 60000)} minuto(s)`
      });
    }
    const user = await store.findByDniRol(dni, rol);
    const passwordCorrecta = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);
    if (!user || !passwordCorrecta) {
      limiter.fail(key);
      return res.status(401).json({ status: 'fail', message: FAIL_MSG });
    }

    limiter.reset(key);
    req.session.regenerate((err) => {
      if (err) {
        console.error('Error regenerando sesión:', err);
        return res.status(500).json({ status: 'fail', message: 'Error interno del servidor' });
      }
      req.session.userId = user.id;
      req.session.rol = user.rol;
      return res.status(200).json({
        status: 'success',
        message: 'Login exitoso',
        data: store.publicUser(user)
      });
    });
  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ status: 'fail', message: 'Error interno del servidor' });
  }
};

exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ status: 'fail', message: 'No se pudo cerrar la sesión' });
    }
    res.clearCookie(COOKIE_NAME);
    return res.status(200).json({ status: 'success', message: 'Sesión cerrada correctamente' });
  });
};
