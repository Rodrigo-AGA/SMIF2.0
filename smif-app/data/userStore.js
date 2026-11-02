const pool = require('../db');

const COLS = `id, rol, nombre, apellidos, dni, email, celular,
              ciclo, modalidad, especialidad, password_hash AS password`;

const publicUser = (u) => ({
  id: u.id,
  rol: u.rol,
  nombre: u.nombre,
  apellidos: u.apellidos,
  dni: u.dni,
  email: u.email,
  celular: u.celular,
  ciclo: u.ciclo,
  modalidad: u.modalidad,
  especialidad: u.especialidad
});

// Todas las consultas son parametrizadas ($1, $2, ...): nunca se concatenan valores.
async function one(sql, params) {
  const r = await pool.query(sql, params);
  return r.rows[0];
}

module.exports = {
  publicUser,

  async add(d) {
    return one(
      `INSERT INTO usuarios
         (rol, nombre, apellidos, dni, email, celular, password_hash, ciclo, modalidad, especialidad)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING ${COLS}`,
      [d.rol, d.nombre, d.apellidos, d.dni, d.email, d.celular, d.password,
       d.ciclo || null, d.modalidad || null, d.especialidad || null]
    );
  },

  findByDniRol: (dni, rol) =>
    one(`SELECT ${COLS} FROM usuarios WHERE dni = $1 AND rol = $2`, [dni, rol]),

  findByDni: (dni) => one(`SELECT ${COLS} FROM usuarios WHERE dni = $1`, [dni]),

  findByEmail: (email) => one(`SELECT ${COLS} FROM usuarios WHERE email = $1`, [email]),

  findById: (id) => one(`SELECT ${COLS} FROM usuarios WHERE id = $1`, [id]),

  async listByRol(rol) {
    const r = await pool.query(`SELECT ${COLS} FROM usuarios WHERE rol = $1 ORDER BY id`, [rol]);
    return r.rows;
  }
};
