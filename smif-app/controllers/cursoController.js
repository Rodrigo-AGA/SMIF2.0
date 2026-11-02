const pool = require('../db');

const COLS = 'id, codigo, nombre, creado_en';
const fail = (res, status, message) => res.status(status).json({ status: 'fail', message });

const idValido = (v) => {
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

function validar(body) {
  const { codigo, nombre } = body || {};
  if ([codigo, nombre].some((v) => typeof v !== 'string' || !v.trim())) {
    return { error: 'Código y nombre son obligatorios' };
  }
  const datos = { codigo: codigo.trim().toUpperCase(), nombre: nombre.trim() };
  if (datos.codigo.length > 20 || datos.nombre.length > 100) {
    return { error: 'Algún campo excede la longitud permitida' };
  }
  return { datos };
}

function manejarError(res, error, mensaje) {
  console.error(error);
  if (error.code === '23505') return fail(res, 409, 'Ya existe un curso con ese código');
  return fail(res, 500, mensaje);
}

exports.getCursos = async (req, res) => {
  try {
    const r = await pool.query(`SELECT ${COLS} FROM cursos ORDER BY codigo`);
    res.status(200).json({ status: 'success', results: r.rows.length, data: r.rows });
  } catch (e) { manejarError(res, e, 'Error al obtener cursos'); }
};

exports.getCursoById = async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return fail(res, 400, 'El ID debe ser un entero positivo');
  try {
    const r = await pool.query(`SELECT ${COLS} FROM cursos WHERE id = $1`, [id]);
    if (r.rows.length === 0) return fail(res, 404, 'Curso no encontrado');
    res.status(200).json({ status: 'success', data: r.rows[0] });
  } catch (e) { manejarError(res, e, 'Error al obtener curso'); }
};

exports.createCurso = async (req, res) => {
  const { datos, error } = validar(req.body);
  if (error) return fail(res, 400, error);
  try {
    const r = await pool.query(
      `INSERT INTO cursos (codigo, nombre) VALUES ($1, $2) RETURNING ${COLS}`,
      [datos.codigo, datos.nombre]
    );
    res.status(201).json({ status: 'success', message: 'Curso creado correctamente', data: r.rows[0] });
  } catch (e) { manejarError(res, e, 'Error al crear curso'); }
};

exports.updateCurso = async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return fail(res, 400, 'El ID debe ser un entero positivo');
  const { datos, error } = validar(req.body);
  if (error) return fail(res, 400, error);
  try {
    const r = await pool.query(
      `UPDATE cursos SET codigo = $1, nombre = $2 WHERE id = $3 RETURNING ${COLS}`,
      [datos.codigo, datos.nombre, id]
    );
    if (r.rows.length === 0) return fail(res, 404, 'Curso no encontrado');
    res.status(200).json({ status: 'success', message: 'Curso actualizado correctamente', data: r.rows[0] });
  } catch (e) { manejarError(res, e, 'Error al actualizar curso'); }
};

exports.deleteCurso = async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return fail(res, 400, 'El ID debe ser un entero positivo');
  try {
    const r = await pool.query(`DELETE FROM cursos WHERE id = $1 RETURNING ${COLS}`, [id]);
    if (r.rows.length === 0) return fail(res, 404, 'Curso no encontrado');
    res.status(200).json({ status: 'success', message: 'Curso eliminado correctamente', data: r.rows[0] });
  } catch (e) { manejarError(res, e, 'Error al eliminar curso'); }
};