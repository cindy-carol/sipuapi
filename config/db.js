const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Konfigurasi SSL wajib begini untuk Supabase + Vercel
  ssl: {
    rejectUnauthorized: false
  },
  // Tambahan agar tidak gampang timeout di serverless
  max: 1, 
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000
});

// Test koneksi biar kelihatan di log Vercel kalau gagal
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = pool;