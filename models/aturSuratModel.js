// models/aturSuratModel.js
const pool = require('../config/db');

const AturSurat = {
  
  // 1️⃣ Ambil settings dengan Fallback yang kuat
  getSettings: async (jenis = 'undangan') => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM atur_surat WHERE jenis_surat = $1 LIMIT 1`,
        [jenis]
      );

      if (!rows[0]) {
        // Balikin objek default supaya Frontend gak kosong pas pertama kali buka
        return {
          jenis_surat: 'undangan',
          kop_surat_text: 'KEMENTERIAN PENDIDIKAN TINGGI, SAINS, DAN TEKNOLOGI\nUNIVERSITAS LAMPUNG - FAKULTAS TEKNIK',
          pembuka: 'Sebagai salah satu syarat untuk menyelesaikan studi pada Program Studi Program Profesi Insinyur (PS-PPI) Universitas Lampung (Unila), maka kami mengundang Bapak/Ibu/Sdr pada:',
          isi: 'Untuk melaksanakan Ujian Akhir Profesi Mahasiswa:',
          penutup: 'Demikian atas perhatian dan kerjasama yang baik kami ucapkan terima kasih.',
        };
      }
      return rows[0];
    } catch (err) {
      console.error('❌ Error getSettings:', err);
      throw err;
    }
  },

  // 2️⃣ Update atau Insert (UPSERT) - ANTI GAGAL
  updateSettings: async (data) => {
    const { jenis_surat, kop_surat_text, pembuka, isi, penutup } = data;
    
    try {
      // Pake ON CONFLICT (untuk PostgreSQL) biar otomatis INSERT kalau belum ada
      // Tanpa perlu SELECT manual dulu. Lebih cepet dan aman.
      const query = `
        INSERT INTO atur_surat (jenis_surat, kop_surat_text, pembuka, isi, penutup, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT (jenis_surat) 
        DO UPDATE SET 
          kop_surat_text = EXCLUDED.kop_surat_text,
          pembuka = EXCLUDED.pembuka,
          isi = EXCLUDED.isi,
          penutup = EXCLUDED.penutup,
          updated_at = NOW()
        RETURNING *;
      `;
      
      const values = [jenis_surat || 'undangan', kop_surat_text, pembuka, isi, penutup];
      const { rows } = await pool.query(query, values);
      
      console.log("✅ Data berhasil di-upsert:", rows[0].jenis_surat);
      return true;
    } catch (err) {
      console.error('❌ Error updateSettings:', err);
      return false;
    }
  }
};

module.exports = AturSurat;