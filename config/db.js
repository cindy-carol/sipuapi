// db.js
const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',           // ganti sesuai user PostgreSQL kamu
  host: 'localhost',          // bisa juga IP/host remote
  database: 'db_skripsi',  // ganti dengan nama database kamu
  password: 'psppi',  // ganti dengan password kamu
  port: 5432,                 // default PostgreSQL port
});

module.exports = pool;
