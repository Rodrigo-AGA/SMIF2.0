const store = require('../data/userStore');
const pool = require('../db');

exports.getProfile = async (req, res) => {
  try {
    const user = await store.findById(req.session.userId);
    if (!user) {
      return res.status(401).json({ status: 'fail', message: 'Acceso no autorizado' });
    }
    return res.status(200).json({ status: 'success', data: store.publicUser(user) });
  } catch (error) {
    console.error('Error en perfil:', error);
    return res.status(500).json({ status: 'fail', message: 'Error interno del servidor' });
  }
};

exports.getAlumnos = async (req, res) => {
  try {
    const alumnos = (await store.listByRol('alumno')).map(store.publicUser);
    return res.status(200).json({ status: 'success', results: alumnos.length, data: alumnos });
  } catch (error) {
    console.error('Error listando alumnos:', error);
    return res.status(500).json({ status: 'fail', message: 'Error interno del servidor' });
  }
};

// Contadores del dashboard (cada rol ve lo suyo)
exports.getResumen = async (req, res) => {
  try {
    const q = async (sql, params = []) => Number((await pool.query(sql, params)).rows[0].total);
    const uid = req.session.userId;
    let data;
    if (req.session.rol === 'docente') {
      data = {
        clases: await q('SELECT COUNT(*) AS total FROM clases WHERE docente_id = $1', [uid]),
        cursos: await q('SELECT COUNT(*) AS total FROM cursos'),
        estudiantes: await q('SELECT COUNT(*) AS total FROM estudiantes'),
        alumnos: await q("SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'alumno'")
      };
    } else {
      data = {
        clases: await q('SELECT COUNT(*) AS total FROM clase_alumnos WHERE alumno_id = $1', [uid]),
        cursos: await q('SELECT COUNT(*) AS total FROM cursos'),
        tareas_pendientes: await q(
          `SELECT COUNT(*) AS total FROM tareas t
             JOIN clase_alumnos ca ON ca.clase_id = t.clase_id AND ca.alumno_id = $1
            WHERE NOT EXISTS (SELECT 1 FROM tareas_hechas th WHERE th.tarea_id = t.id AND th.alumno_id = $1)`, [uid])
      };
    }
    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    console.error('Error en resumen:', error);
    return res.status(500).json({ status: 'fail', message: 'Error interno del servidor' });
  }
};
