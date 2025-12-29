const pool = require('../config/db');

const AturSurat = {
  // Ambil pengaturan surat (biasanya cuma ada 1 baris untuk jenis 'undangan')
  getSettings: async (jenis = 'undangan') => {
    const { rows } = await pool.query(
      `SELECT * FROM atur_surat WHERE jenis_surat = $1 LIMIT 1`,
      [jenis]
    );
    // Jika belum ada di DB, return default object biar gak error
    if (!rows[0]) {
      return {
        kop_surat_text: 'KEMENTERIAN PENDIDIKAN TINGGI, SAINS, DAN TEKNOLOGI\nUNIVERSITAS LAMPUNG - FAKULTAS TEKNIK',
        pembuka: 'Sebagai salah satu syarat untuk menyelesaikan studi pada Program Studi Program Profesi Insinyur (PS-PPI) Universitas Lampung (Unila), maka kami mengundang Bapak/Ibu/Sdr pada:',
        penutup: 'Demikian atas perhatian dan kerjasama yang baik kami ucapkan terima kasih.',
      };
    }
    return rows[0];
  },

  // Update pengaturan surat
  updateSettings: async (data) => {
    const { jenis_surat, kop_surat_text, pembuka, isi, penutup } = data;
    
    // Cek dulu ada datanya gak
    const cek = await pool.query(`SELECT id FROM atur_surat WHERE jenis_surat = $1`, [jenis_surat]);
    
    if (cek.rows.length > 0) {
      // Update existing
      await pool.query(
        `UPDATE atur_surat 
         SET kop_surat_text = $1, pembuka = $2, isi = $3, penutup = $4, updated_at = NOW()
         WHERE jenis_surat = $5`,
        [kop_surat_text, pembuka, isi, penutup, jenis_surat]
      );
    } else {
      // Insert baru kalo tabel kosong
      await pool.query(
        `INSERT INTO atur_surat (jenis_surat, kop_surat_text, pembuka, isi, penutup)
         VALUES ($1, $2, $3, $4, $5)`,
        [jenis_surat, kop_surat_text, pembuka, isi, penutup]
      );
    }
    return true;
  }
};

module.exports = AturSurat;