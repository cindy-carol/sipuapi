const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Ambil dari Vercel Env
  ssl: {
    rejectUnauthorized: false // INI HARUS ADA UNTUK FIX ERROR TERSEBUT
  }
});

module.exports = pool;