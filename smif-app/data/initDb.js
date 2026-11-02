const fs = require('fs');
const path = require('path');
const pool = require('../db');

// Verifica la conexión y crea las tablas si no existen.
module.exports = async function initDb() {
  await pool.query('SELECT 1');
  const sql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('Conexión a PostgreSQL verificada y tablas listas.');
};
