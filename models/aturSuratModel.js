// models/aturSuratModel.js
const pool = require('../config/db');

/**
 * ============================================================
 * 📝 MODEL: ATUR SURAT
 * ============================================================
 * Mengelola template teks untuk pembuatan Surat Undangan Ujian.
 * Memungkinkan admin mengubah Kop, Pembuka, dan Penutup secara dinamis.
 */
const AturSurat = {
  
  // 1️⃣ Ambil pengaturan surat (Default jenis: 'undangan')
  getSettings: async (jenis = 'undangan') => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM atur_surat WHERE jenis_surat = $1 LIMIT 1`,
        [jenis]
      );

      // 🛡️ Fallback: Jika data belum ada di DB, kirim objek default agar sistem tidak crash
      if (!rows[0]) {
        return {
          jenis_surat: 'undangan',
          kop_surat_text: 'KEMENTERIAN PENDIDIKAN TINGGI, SAINS, DAN TEKNOLOGI\nUNIVERSITAS LAMPUNG - FAKULTAS TEKNIK',
          pembuka: 'Sebagai salah satu syarat untuk menyelesaikan studi pada Program Studi Program Profesi Insinyur (PS-PPI) Universitas Lampung (Unila), maka kami mengundang Bapak/Ibu/Sdr pada:',
          isi: null, // Isi biasanya berisi data dinamis mahasiswa
          penutup: 'Demikian atas perhatian dan kerjasama yang baik kami ucapkan terima kasih.',
        };
      }
      return rows[0];
    } catch (err) {
      console.error('❌ Error getSettings Surat:', err);
      throw err;
    }
  },

  // 2️⃣ Update atau Insert pengaturan surat (UPSERT Logic)
  updateSettings: async (data) => {
    const { jenis_surat, kop_surat_text, pembuka, isi, penutup } = data;
    
    try {
      // Cek apakah pengaturan untuk jenis surat tersebut sudah ada
      const cek = await pool.query(
        `SELECT id FROM atur_surat WHERE jenis_surat = $1`, 
        [jenis_surat]
      );
      
      if (cek.rows.length > 0) {
        // Logika UPDATE jika data sudah ada
        await pool.query(
          `UPDATE atur_surat 
           SET kop_surat_text = $1, pembuka = $2, isi = $3, penutup = $4, updated_at = NOW()
           WHERE jenis_surat = $5`,
          [kop_surat_text, pembuka, isi, penutup, jenis_surat]
        );
      } else {
        // Logika INSERT jika data benar-benar baru
        await pool.query(
          `INSERT INTO atur_surat (jenis_surat, kop_surat_text, pembuka, isi, penutup, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [jenis_surat, kop_surat_text, pembuka, isi, penutup]
        );
      }
      return true;
    } catch (err) {
      console.error('❌ Error updateSettings Surat:', err);
      return false;
    }
  }
};

module.exports = AturSurat;