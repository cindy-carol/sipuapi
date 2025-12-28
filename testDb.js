const pool = require('./config/db'); // path ke file db.js

(async () => {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('Database connected, waktu sekarang:', res.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error('Database connection failed:', err);
    process.exit(1);
  }
})();
