const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1 // Sangat disarankan untuk Vercel agar tidak menghabiskan kuota koneksi Supabase
});

module.exports = pool;