const pool = require('../db');
const { HttpError, idValido, enviarError } = require('../utils/http');

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const SEL = `c.id, c.nombre, c.dia_semana,
             to_char(c.hora_inicio, 'HH24:MI') AS hora_inicio,
             to_char(c.hora_fin, 'HH24:MI') AS hora_fin, c.creado_en`;

// ---------- validación ----------
function validar(body) {
  const b = body || {};
  if (typeof b.nombre !== 'string' || !b.nombre.trim() || b.nombre.trim().length > 100) {
    throw new HttpError(400, 'El nombre de la clase es obligatorio (máximo 100 caracteres)');
  }
  const dia = Number(b.dia_semana);
  if (!Number.isInteger(dia) || dia < 1 || dia > 7) {
    throw new HttpError(400, 'El día debe estar entre 1 (lunes) y 7 (domingo)');
  }
  const inicio = String(b.hora_inicio || '');
  const fin = String(b.hora_fin || '');
  if (!HORA_RE.test(inicio) || !HORA_RE.test(fin)) {
    throw new HttpError(400, 'Debes indicar la hora de inicio y de fin (formato HH:MM)');
  }
  if (fin <= inicio) throw new HttpError(400, 'La hora de fin debe ser posterior a la de inicio');

  const lista = b.alumnos === undefined ? [] : b.alumnos;
  if (!Array.isArray(lista) || lista.length > 200 ||
      lista.some((n) => typeof n === 'boolean' || !Number.isSafeInteger(Number(n)) || Number(n) <= 0)) {
    throw new HttpError(400, 'La lista de alumnos no es válida');
  }
  return { nombre: b.nombre.trim(), dia, inicio, fin, alumnos: [...new Set(lista.map(Number))] };
}

// ---------- transacción (serializa los cambios de horario para evitar choques simultáneos) ----------
async function enTransaccion(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(90001)');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function verificarAlumnos(client, ids) {
  if (ids.length === 0) return;
  const r = await client.query(
    `SELECT id FROM usuarios WHERE rol = 'alumno' AND id = ANY($1::bigint[])`, [ids]
  );
  if (r.rows.length !== ids.length) {
    throw new HttpError(400, 'Alguno de los alumnos seleccionados no existe');
  }
}

// Dos clases chocan si son el mismo día y sus rangos se solapan (terminar a las 10:00 y empezar a las 10:00 NO choca)
async function verificarChoques(client, d, docenteId, excluirClaseId) {
  const etiqueta = (x) => `"${x.clase}" (${DIAS[x.dia_semana - 1]} ${x.ini} a ${x.fin})`;

  const prof = await client.query(
    `SELECT c.nombre AS clase, c.dia_semana, to_char(c.hora_inicio,'HH24:MI') AS ini, to_char(c.hora_fin,'HH24:MI') AS fin
       FROM clases c
      WHERE c.docente_id = $1 AND c.dia_semana = $2
        AND c.hora_inicio < $4::time AND $3::time < c.hora_fin
        AND ($5::int IS NULL OR c.id <> $5)
      LIMIT 1`,
    [docenteId, d.dia, d.inicio, d.fin, excluirClaseId]
  );
  if (prof.rows.length) {
    throw new HttpError(409, `Choque de horario: ya tienes la clase ${etiqueta(prof.rows[0])}`);
  }

  if (d.alumnos.length === 0) return;
  const alu = await client.query(
    `SELECT u.nombre || ' ' || u.apellidos AS alumno, c.nombre AS clase, c.dia_semana,
            to_char(c.hora_inicio,'HH24:MI') AS ini, to_char(c.hora_fin,'HH24:MI') AS fin
       FROM clase_alumnos ca
       JOIN clases c   ON c.id = ca.clase_id
       JOIN usuarios u ON u.id = ca.alumno_id
      WHERE ca.alumno_id = ANY($1::bigint[]) AND c.dia_semana = $2
        AND c.hora_inicio < $4::time AND $3::time < c.hora_fin
        AND ($5::int IS NULL OR c.id <> $5)
      LIMIT 1`,
    [d.alumnos, d.dia, d.inicio, d.fin, excluirClaseId]
  );
  if (alu.rows.length) {
    const x = alu.rows[0];
    throw new HttpError(409, `Choque de horario: ${x.alumno} ya está en la clase ${etiqueta(x)}`);
  }
}

// ---------- consultas de detalle ----------
async function detalleDocente(id, docenteId) {
  const r = await pool.query(`SELECT ${SEL} FROM clases c WHERE c.id = $1 AND c.docente_id = $2`, [id, docenteId]);
  if (r.rows.length === 0) return null;
  const alumnos = await pool.query(
    `SELECT u.id, u.nombre, u.apellidos, u.dni
       FROM clase_alumnos ca JOIN usuarios u ON u.id = ca.alumno_id
      WHERE ca.clase_id = $1 ORDER BY u.apellidos, u.nombre`, [id]);
  return { ...r.rows[0], alumnos: alumnos.rows };
}

// ---------- endpoints ----------
// GET /api/clases  (profesor: las que dicta; estudiante: en las que está inscrito)
exports.getClases = async (req, res) => {
  try {
    const uid = req.session.userId;
    const r = req.session.rol === 'docente'
      ? await pool.query(
          `SELECT ${SEL},
                  (SELECT COUNT(*) FROM clase_alumnos WHERE clase_id = c.id)::int AS total_alumnos,
                  (SELECT COUNT(*) FROM tareas WHERE clase_id = c.id)::int AS total_tareas
             FROM clases c WHERE c.docente_id = $1
            ORDER BY c.dia_semana, c.hora_inicio`, [uid])
      : await pool.query(
          `SELECT ${SEL}, d.nombre || ' ' || d.apellidos AS docente
             FROM clases c
             JOIN clase_alumnos ca ON ca.clase_id = c.id AND ca.alumno_id = $1
             JOIN usuarios d ON d.id = c.docente_id
            ORDER BY c.dia_semana, c.hora_inicio`, [uid]);
    res.status(200).json({ status: 'success', results: r.rows.length, data: r.rows });
  } catch (e) { enviarError(res, e, 'Error al obtener las clases'); }
};

// GET /api/clases/:id
exports.getClaseById = async (req, res) => {
  try {
    const id = idValido(req.params.id);
    if (!id) throw new HttpError(400, 'El ID debe ser un entero positivo');
    let data;
    if (req.session.rol === 'docente') {
      data = await detalleDocente(id, req.session.userId);
    } else {
      const r = await pool.query(
        `SELECT ${SEL}, d.nombre || ' ' || d.apellidos AS docente
           FROM clases c
           JOIN clase_alumnos ca ON ca.clase_id = c.id AND ca.alumno_id = $2
           JOIN usuarios d ON d.id = c.docente_id
          WHERE c.id = $1`, [id, req.session.userId]);
      data = r.rows[0];
    }
    if (!data) throw new HttpError(404, 'Clase no encontrada');
    res.status(200).json({ status: 'success', data });
  } catch (e) { enviarError(res, e, 'Error al obtener la clase'); }
};

// POST /api/clases
exports.createClase = async (req, res) => {
  try {
    const d = validar(req.body);
    const id = await enTransaccion(async (c) => {
      await verificarAlumnos(c, d.alumnos);
      await verificarChoques(c, d, req.session.userId, null);
      const r = await c.query(
        `INSERT INTO clases (nombre, docente_id, dia_semana, hora_inicio, hora_fin)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [d.nombre, req.session.userId, d.dia, d.inicio, d.fin]);
      if (d.alumnos.length) {
        await c.query(`INSERT INTO clase_alumnos (clase_id, alumno_id) SELECT $1, unnest($2::int[])`,
          [r.rows[0].id, d.alumnos]);
      }
      return r.rows[0].id;
    });
    const data = await detalleDocente(id, req.session.userId);
    res.status(201).json({ status: 'success', message: 'Clase creada correctamente', data });
  } catch (e) { enviarError(res, e, 'Error al crear la clase'); }
};

// PUT /api/clases/:id  (reemplaza nombre, horario y lista de alumnos)
exports.updateClase = async (req, res) => {
  try {
    const id = idValido(req.params.id);
    if (!id) throw new HttpError(400, 'El ID debe ser un entero positivo');
    const d = validar(req.body);
    await enTransaccion(async (c) => {
      const propia = await c.query('SELECT id FROM clases WHERE id = $1 AND docente_id = $2 FOR UPDATE',
        [id, req.session.userId]);
      if (propia.rows.length === 0) throw new HttpError(404, 'Clase no encontrada');
      await verificarAlumnos(c, d.alumnos);
      await verificarChoques(c, d, req.session.userId, id);
      await c.query(
        `UPDATE clases SET nombre = $1, dia_semana = $2, hora_inicio = $3, hora_fin = $4 WHERE id = $5`,
        [d.nombre, d.dia, d.inicio, d.fin, id]);
      await c.query('DELETE FROM clase_alumnos WHERE clase_id = $1', [id]);
      if (d.alumnos.length) {
        await c.query(`INSERT INTO clase_alumnos (clase_id, alumno_id) SELECT $1, unnest($2::int[])`, [id, d.alumnos]);
      }
      // Quien salió de la clase pierde sus marcas de tareas hechas de esa clase
      await c.query(
        `DELETE FROM tareas_hechas th USING tareas t
          WHERE th.tarea_id = t.id AND t.clase_id = $1 AND th.alumno_id <> ALL($2::bigint[])`,
        [id, d.alumnos]);
    });
    const data = await detalleDocente(id, req.session.userId);
    res.status(200).json({ status: 'success', message: 'Clase actualizada correctamente', data });
  } catch (e) { enviarError(res, e, 'Error al actualizar la clase'); }
};

// DELETE /api/clases/:id  (borra también sus tareas e inscripciones)
exports.deleteClase = async (req, res) => {
  try {
    const id = idValido(req.params.id);
    if (!id) throw new HttpError(400, 'El ID debe ser un entero positivo');
    const r = await pool.query('DELETE FROM clases WHERE id = $1 AND docente_id = $2 RETURNING id, nombre',
      [id, req.session.userId]);
    if (r.rows.length === 0) throw new HttpError(404, 'Clase no encontrada');
    res.status(200).json({ status: 'success', message: 'Clase eliminada correctamente', data: r.rows[0] });
  } catch (e) { enviarError(res, e, 'Error al eliminar la clase'); }
};
