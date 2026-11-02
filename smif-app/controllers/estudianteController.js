const pool = require('../db');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COLS = 'id, nombre, email, carrera, creado_en';

const idValido = (v) => {
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

// Valida y normaliza el cuerpo; devuelve { datos } o { error }
function validar(body) {
  const { nombre, email, carrera } = body || {};
  if ([nombre, email, carrera].some((v) => typeof v !== 'string' || !v.trim())) {
    return { error: 'Nombre, email y carrera son obligatorios' };
  }
  const datos = { nombre: nombre.trim(), email: email.trim().toLowerCase(), carrera: carrera.trim() };
  if (datos.nombre.length > 100 || datos.email.length > 100 || datos.carrera.length > 80) {
    return { error: 'Algún campo excede la longitud permitida' };
  }
  if (!EMAIL_RE.test(datos.email)) return { error: 'Correo electrónico inválido' };
  return { datos };
}

const fail = (res, status, message) => res.status(status).json({ status: 'fail', message });

function manejarError(res, error, mensaje) {
  console.error(error);
  if (error.code === '23505') return fail(res, 409, 'El email ya está registrado');
  return fail(res, 500, mensaje);
}

// GET /api/estudiantes
exports.getEstudiantes = async (req, res) => {
  try {
    const r = await pool.query(`SELECT ${COLS} FROM estudiantes ORDER BY id`);
    res.status(200).json({ status: 'success', results: r.rows.length, data: r.rows });
  } catch (error) {
    manejarError(res, error, 'Error al obtener estudiantes');
  }
};

// GET /api/estudiantes/:id
exports.getEstudianteById = async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return fail(res, 400, 'El ID debe ser un entero positivo');
  try {
    const r = await pool.query(`SELECT ${COLS} FROM estudiantes WHERE id = $1`, [id]);
    if (r.rows.length === 0) return fail(res, 404, 'Estudiante no encontrado');
    res.status(200).json({ status: 'success', data: r.rows[0] });
  } catch (error) {
    manejarError(res, error, 'Error al obtener estudiante');
  }
};

// POST /api/estudiantes
exports.createEstudiante = async (req, res) => {
  const { datos, error } = validar(req.body);
  if (error) return fail(res, 400, error);
  try {
    const r = await pool.query(
      `INSERT INTO estudiantes (nombre, email, carrera)
       VALUES ($1, $2, $3)
       RETURNING ${COLS}`,
      [datos.nombre, datos.email, datos.carrera]
    );
    res.status(201).json({ status: 'success', message: 'Estudiante creado correctamente', data: r.rows[0] });
  } catch (err) {
    manejarError(res, err, 'Error al crear estudiante');
  }
};

// PUT /api/estudiantes/:id
exports.updateEstudiante = async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return fail(res, 400, 'El ID debe ser un entero positivo');
  const { datos, error } = validar(req.body);
  if (error) return fail(res, 400, error);
  try {
    const r = await pool.query(
      `UPDATE estudiantes
       SET nombre = $1, email = $2, carrera = $3
       WHERE id = $4
       RETURNING ${COLS}`,
      [datos.nombre, datos.email, datos.carrera, id]
    );
    if (r.rows.length === 0) return fail(res, 404, 'Estudiante no encontrado');
    res.status(200).json({ status: 'success', message: 'Estudiante actualizado correctamente', data: r.rows[0] });
  } catch (err) {
    manejarError(res, err, 'Error al actualizar estudiante');
  }
};

// DELETE /api/estudiantes/:id
exports.deleteEstudiante = async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return fail(res, 400, 'El ID debe ser un entero positivo');
  try {
    const r = await pool.query(`DELETE FROM estudiantes WHERE id = $1 RETURNING ${COLS}`, [id]);
    if (r.rows.length === 0) return fail(res, 404, 'Estudiante no encontrado');
    res.status(200).json({ status: 'success', message: 'Estudiante eliminado correctamente', data: r.rows[0] });
  } catch (error) {
    manejarError(res, error, 'Error al eliminar estudiante');
  }
};
