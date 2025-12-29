// models/tahunAjaranModel.js
const pool = require('../config/db');

/**
 * ============================================================
 * 🗓️ MODEL: TAHUN AJARAN
 * ============================================================
 * Mengelola periode akademik (Semester Ganjil/Genap) yang 
 * menjadi filter utama di seluruh dashboard aplikasi.
 */
const TahunAjaran = {

  /**
   * 🔎 1. Cari tahun ajaran berdasarkan nama_tahun dan semester
   */
  findByNamaDanSemester: async (nama_tahun, semester) => {
    try {
      const result = await pool.query(
        `
        SELECT *
        FROM tahun_ajaran
        WHERE nama_tahun = $1 AND semester = $2
        LIMIT 1
        `,
        [nama_tahun, semester]
      );
      return result.rows[0] || null;
    } catch (err) {
      console.error('❌ Error findByNamaDanSemester:', err);
      throw err;
    }
  },

  /**
   * ➕ 2. Tambah tahun ajaran baru
   */
  create: async ({ nama_tahun, semester, status = false }) => {
    const result = await pool.query(
      `
      INSERT INTO tahun_ajaran (nama_tahun, semester, status)
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [nama_tahun, semester, status]
    );
    return result.rows[0];
  },

  /**
   * 📋 3. Ambil semua data tahun ajaran
   */
  getAll: async () => {
    const result = await pool.query(`
      SELECT *
      FROM tahun_ajaran
      ORDER BY nama_tahun DESC, semester DESC
    `);
    return result.rows;
  },

  /**
   * 🔽 4. Ambil daftar untuk dropdown <select> (Optimasi Label)
   * Menggabungkan nama tahun dan semester langsung di level database.
   */
  getListForSelect: async () => {
    const query = `
      SELECT DISTINCT ON (nama_tahun, semester)
        id, 
        (nama_tahun || ' ' || semester) AS label
      FROM tahun_ajaran
      ORDER BY nama_tahun DESC, semester DESC, id DESC;
    `;
    const { rows } = await pool.query(query);
    return rows;
  },

  /**
   * 🆔 5. Ambil detail satu tahun ajaran berdasarkan ID
   */
  findById: async (id) => {
    const query = `
      SELECT 
        id, 
        nama_tahun, 
        semester,
        (nama_tahun || ' ' || semester) AS label
      FROM tahun_ajaran
      WHERE id = $1
      LIMIT 1
    `;
    const { rows } = await pool.query(query, [id]);
    return rows[0] || null;
  },

  /**
   * 🏷️ 6. Cari berdasarkan label lengkap
   * Contoh input: "2024/2025 Genap"
   */
  findByLabel: async (label) => {
    const query = `
      SELECT *
      FROM tahun_ajaran
      WHERE (nama_tahun || ' ' || semester) = $1
      LIMIT 1
    `;
    const { rows } = await pool.query(query, [label]);
    return rows[0] || null;
  },

  /**
   * 🔝 7. Ambil ID terbaru (Tahun Ajaran Paling Baru)
   */
  getLatestId: async () => {
    const query = `
      SELECT id FROM tahun_ajaran 
      ORDER BY nama_tahun DESC, semester DESC 
      LIMIT 1
    `;
    const result = await pool.query(query);
    return result.rows[0] ? result.rows[0].id : null;
  }
};

module.exports = { TahunAjaran };