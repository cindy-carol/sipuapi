const pool = require('../config/db.js');

const TahunAjaran = {
  /**
   * Cari tahun ajaran berdasarkan nama_tahun dan semester
   */
  findByNamaDanSemester: async (nama_tahun, semester) => {
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
  },

  /**
   * Tambah tahun ajaran baru
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
   * Ambil semua data tahun ajaran
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
   * Ambil daftar tahun ajaran untuk dropdown <select>
   * Output: [{ id: 5, label: "2025/2026 Ganjil" }, ...]
   */
getListForSelect: async () => {
const query = `SELECT DISTINCT ON (nama_tahun, semester)
id, 
(nama_tahun || ' ' || semester) AS label
FROM tahun_ajaran
ORDER BY nama_tahun DESC, semester DESC, id DESC;
`;
const { rows } = await pool.query(query);
return rows;
},

  /**
   * Ambil detail satu tahun ajaran berdasarkan ID
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
 * Cari tahun ajaran berdasarkan gabungan "nama_tahun semester"
 * Contoh: "2024/2025 genap"
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

  getLatestId: async () => {
    const query = `SELECT id FROM tahun_ajaran 
                   ORDER BY nama_tahun DESC, semester DESC 
                   LIMIT 1`;
    const result = await pool.query(query);
    return result.rows[0] ? result.rows[0].id : null;
  }
};

module.exports = { TahunAjaran };
