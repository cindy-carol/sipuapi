// models/aturSuratModel.js
const pool = require('../config/db');

const AturSurat = {
  // Ambil data (Kalo kosong kasih default)
  getSettings: async (jenis = 'undangan') => {
    const { rows } = await pool.query(
      "SELECT * FROM atur_surat WHERE jenis_surat = $1", 
      [jenis]
    );
    return rows[0] || null;
  },

  // Fungsi sakti biar data masuk ke database
// models/aturSuratModel.js
updateSettings: async (data) => {
  const { jenis_surat, kop_surat_text, pembuka, isi, penutup, catatan_kaki } = data;
  try {
    const query = `
      INSERT INTO atur_surat (jenis_surat, kop_surat_text, pembuka, isi, penutup, catatan_kaki, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (jenis_surat) 
      DO UPDATE SET 
        kop_surat_text = EXCLUDED.kop_surat_text,
        pembuka = EXCLUDED.pembuka,
        isi = EXCLUDED.isi,
        penutup = EXCLUDED.penutup,
        catatan_kaki = EXCLUDED.catatan_kaki,
        updated_at = NOW()
      RETURNING *;
    `;
    const values = [jenis_surat || 'undangan', kop_surat_text, pembuka, isi, penutup, catatan_kaki];
    await pool.query(query, values);
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}
};

module.exports = AturSurat;