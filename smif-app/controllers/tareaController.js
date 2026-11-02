const pool = require('../db');
const { HttpError, idValido, enviarError } = require('../utils/http');

const FECHA_SEL = `to_char(t.fecha_limite, 'YYYY-MM-DD') AS fecha_limite`;

function validar(body) {
  const b = body || {};
  if (typeof b.titulo !== 'string' || !b.titulo.trim() || b.titulo.trim().length > 150) {
    throw new HttpError(400, 'El título es obligatorio (máximo 150 caracteres)');
  }
  const descripcion = typeof b.descripcion === 'string' ? b.descripcion.trim() : '';
  if (descripcion.length > 500) throw new HttpError(400, 'La descripción no puede superar 500 caracteres');

  let fecha = null;
  if (b.fecha_limite !== undefined && b.fecha_limite !== null && b.fecha_limite !== '') {
    const f = String(b.fecha_limite);
    const real = /^\d{4}-\d{2}-\d{2}$/.test(f) && new Date(`${f}T00:00:00Z`).toISOString().slice(0, 10) === f;
    if (!real) throw new HttpError(400, 'La fecha límite no es válida (AAAA-MM-DD)');
    fecha = f;
  }
  return { titulo: b.titulo.trim(), descripcion: descripcion || null, fecha };
}

// ¿La clase pertenece al profesor / el alumno está inscrito?
async function claseAccesible(req, claseId) {
  const r = req.session.rol === 'docente'
    ? await pool.query('SELECT id FROM clases WHERE id = $1 AND docente_id = $2', [claseId, req.session.userId])
    : await pool.query('SELECT clase_id AS id FROM clase_alumnos WHERE clase_id = $1 AND alumno_id = $2',
        [claseId, req.session.userId]);
  return r.rows[0];
}

// Tarea que pertenece a una clase del profesor
async function tareaDelDocente(tareaId, docenteId) {
  const r = await pool.query(
    `SELECT t.id FROM tareas t JOIN clases c ON c.id = t.clase_id WHERE t.id = $1 AND c.docente_id = $2`,
    [tareaId, docenteId]);
  return r.rows[0];
}

// GET /api/clases/:id/tareas
exports.listByClase = async (req, res) => {
  try {
    const claseId = idValido(req.params.id);
    if (!claseId) throw new HttpError(400, 'El ID debe ser un entero positivo');
    if (!(await claseAccesible(req, claseId))) throw new HttpError(404, 'Clase no encontrada');

    const r = req.session.rol === 'docente'
      ? await pool.query(
          `SELECT t.id, t.titulo, t.descripcion, ${FECHA_SEL},
                  (SELECT COUNT(*) FROM tareas_hechas th WHERE th.tarea_id = t.id)::int AS hechas,
                  (SELECT COUNT(*) FROM clase_alumnos ca WHERE ca.clase_id = t.clase_id)::int AS total
             FROM tareas t WHERE t.clase_id = $1 ORDER BY t.fecha_limite NULLS LAST, t.id`, [claseId])
      : await pool.query(
          `SELECT t.id, t.titulo, t.descripcion, ${FECHA_SEL},
                  EXISTS (SELECT 1 FROM tareas_hechas th WHERE th.tarea_id = t.id AND th.alumno_id = $2) AS hecha
             FROM tareas t WHERE t.clase_id = $1 ORDER BY t.fecha_limite NULLS LAST, t.id`,
          [claseId, req.session.userId]);
    res.status(200).json({ status: 'success', results: r.rows.length, data: r.rows });
  } catch (e) { enviarError(res, e, 'Error al obtener las tareas'); }
};

// POST /api/clases/:id/tareas   (profesor)
exports.createTarea = async (req, res) => {
  try {
    const claseId = idValido(req.params.id);
    if (!claseId) throw new HttpError(400, 'El ID debe ser un entero positivo');
    if (!(await claseAccesible(req, claseId))) throw new HttpError(404, 'Clase no encontrada');
    const d = validar(req.body);
    const r = await pool.query(
      `INSERT INTO tareas (clase_id, titulo, descripcion, fecha_limite) VALUES ($1, $2, $3, $4)
       RETURNING id, titulo, descripcion, to_char(fecha_limite, 'YYYY-MM-DD') AS fecha_limite`,
      [claseId, d.titulo, d.descripcion, d.fecha]);
    res.status(201).json({ status: 'success', message: 'Tarea creada correctamente', data: r.rows[0] });
  } catch (e) { enviarError(res, e, 'Error al crear la tarea'); }
};

// PUT /api/tareas/:id   (profesor)
exports.updateTarea = async (req, res) => {
  try {
    const id = idValido(req.params.id);
    if (!id) throw new HttpError(400, 'El ID debe ser un entero positivo');
    const d = validar(req.body);
    if (!(await tareaDelDocente(id, req.session.userId))) throw new HttpError(404, 'Tarea no encontrada');
    const r = await pool.query(
      `UPDATE tareas SET titulo = $1, descripcion = $2, fecha_limite = $3 WHERE id = $4
       RETURNING id, titulo, descripcion, to_char(fecha_limite, 'YYYY-MM-DD') AS fecha_limite`,
      [d.titulo, d.descripcion, d.fecha, id]);
    res.status(200).json({ status: 'success', message: 'Tarea actualizada correctamente', data: r.rows[0] });
  } catch (e) { enviarError(res, e, 'Error al actualizar la tarea'); }
};

// DELETE /api/tareas/:id   (profesor)
exports.deleteTarea = async (req, res) => {
  try {
    const id = idValido(req.params.id);
    if (!id) throw new HttpError(400, 'El ID debe ser un entero positivo');
    if (!(await tareaDelDocente(id, req.session.userId))) throw new HttpError(404, 'Tarea no encontrada');
    await pool.query('DELETE FROM tareas WHERE id = $1', [id]);
    res.status(200).json({ status: 'success', message: 'Tarea eliminada correctamente' });
  } catch (e) { enviarError(res, e, 'Error al eliminar la tarea'); }
};

// GET /api/tareas/:id/estado   (profesor: quién la hizo)
exports.estadoTarea = async (req, res) => {
  try {
    const id = idValido(req.params.id);
    if (!id) throw new HttpError(400, 'El ID debe ser un entero positivo');
    if (!(await tareaDelDocente(id, req.session.userId))) throw new HttpError(404, 'Tarea no encontrada');
    const r = await pool.query(
      `SELECT u.id, u.nombre, u.apellidos, u.dni, (th.tarea_id IS NOT NULL) AS hecha, th.hecha_en
         FROM tareas t
         JOIN clase_alumnos ca ON ca.clase_id = t.clase_id
         JOIN usuarios u ON u.id = ca.alumno_id
         LEFT JOIN tareas_hechas th ON th.tarea_id = t.id AND th.alumno_id = u.id
        WHERE t.id = $1 ORDER BY u.apellidos, u.nombre`, [id]);
    res.status(200).json({ status: 'success', results: r.rows.length, data: r.rows });
  } catch (e) { enviarError(res, e, 'Error al obtener el estado de la tarea'); }
};

// GET /api/tareas   (estudiante: todas sus tareas)
exports.misTareas = async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT t.id, t.titulo, t.descripcion, ${FECHA_SEL}, c.nombre AS clase,
              EXISTS (SELECT 1 FROM tareas_hechas th WHERE th.tarea_id = t.id AND th.alumno_id = $1) AS hecha
         FROM tareas t
         JOIN clases c ON c.id = t.clase_id
         JOIN clase_alumnos ca ON ca.clase_id = c.id AND ca.alumno_id = $1
        ORDER BY hecha, t.fecha_limite NULLS LAST, t.id`, [req.session.userId]);
    res.status(200).json({ status: 'success', results: r.rows.length, data: r.rows });
  } catch (e) { enviarError(res, e, 'Error al obtener tus tareas'); }
};

// POST /api/tareas/:id/hecha   (estudiante: ÚNICA acción permitida sobre una tarea)
exports.marcarHecha = async (req, res) => {
  try {
    const id = idValido(req.params.id);
    if (!id) throw new HttpError(400, 'El ID debe ser un entero positivo');
    const t = await pool.query('SELECT clase_id FROM tareas WHERE id = $1', [id]);
    if (t.rows.length === 0) throw new HttpError(404, 'Tarea no encontrada');
    const inscrito = await pool.query('SELECT 1 FROM clase_alumnos WHERE clase_id = $1 AND alumno_id = $2',
      [t.rows[0].clase_id, req.session.userId]);
    if (inscrito.rows.length === 0) throw new HttpError(403, 'Esta tarea no pertenece a una de tus clases');
    await pool.query(
      'INSERT INTO tareas_hechas (tarea_id, alumno_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [id, req.session.userId]);
    res.status(200).json({ status: 'success', message: 'Tarea marcada como hecha', data: { id, hecha: true } });
  } catch (e) { enviarError(res, e, 'Error al marcar la tarea'); }
};
