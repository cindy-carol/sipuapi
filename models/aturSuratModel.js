const pool = require('../config/db');

const AturSurat = {
  getSettings: async (jenis = 'undangan') => {
    const { rows } = await pool.query(
      "SELECT * FROM atur_surat WHERE jenis_surat = $1", 
      [jenis]
    );
    return rows[0] || null;
  },

updateSettings: async (data) => {
  const { jenis_surat, kop_surat_text, pembuka, isi, penutup } = data;
  
  // Gunakan Client dari pool untuk memastikan kedua query berjalan (Transaction)
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN'); // Memulai transaksi

    // 1. Update atau Insert Template di tabel atur_surat
    const queryTemplate = `
      INSERT INTO atur_surat (jenis_surat, kop_surat_text, pembuka, isi, penutup, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (jenis_surat) 
      DO UPDATE SET 
        kop_surat_text = EXCLUDED.kop_surat_text,
        pembuka = EXCLUDED.pembuka,
        isi = EXCLUDED.isi,
        penutup = EXCLUDED.penutup,
        updated_at = NOW()
      RETURNING *;
    `;
    
    const valuesTemplate = [
      jenis_surat || 'undangan', 
      kop_surat_text, 
      pembuka, 
      isi, 
      penutup
    ];

    await client.query(queryTemplate, valuesTemplate);

    // 2. Reset kolom last_download_at di tabel surat menjadi NULL
    // Ini yang akan memicu tombol di frontend berubah jadi "Download Ulang"
    const queryResetDownload = `
      UPDATE surat 
      SET last_download_at = NULL 
      WHERE last_download_at IS NOT NULL;
    `;
    
    await client.query(queryResetDownload);

    await client.query('COMMIT'); // Simpan semua perubahan
    return true; 

  } catch (err) {
    await client.query('ROLLBACK'); // Batalkan jika ada yang gagal
    console.error("❌ Database Error:", err);
    return false;
  } finally {
    client.release(); // Kembalikan koneksi ke pool
  }
}
};

module.exports = AturSurat;