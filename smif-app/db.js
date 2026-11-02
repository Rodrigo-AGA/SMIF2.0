require('dotenv').config();
const { Pool } = require('pg');

// Nube: DATABASE_URL (Render/Supabase). Local: variables DB_*.
const ssl = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;

const config = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL, ssl }
  : {
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: Number(process.env.DB_PORT) || 5432,
      ssl
    };

const pool = new Pool(config);
pool.on('error', (err) => console.error('Error inesperado en el Pool de PostgreSQL:', err.message));

module.exports = pool;
