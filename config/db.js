// db.js
const { Pool } = require('pg');

// Gunakan connectionString agar otomatis membaca DATABASE_URL dari Vercel
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Wajib diaktifkan agar bisa konek ke Supabase/Cloud DB
  }
});

module.exports = pool;