// models/statusModel.js
const pool = require('../config/db');

/**
 * ============================================================
 * 🛠️ FUNGSI BANTU: LOGIKA STATUS UTAMA
 * ============================================================
 * Menentukan label status berdasarkan hirarki proses pendaftaran.
 * Urutan pengecekan sangat penting (Waterfall Logic).
 */
function getOverallStatus(row) {
  if (!row.sudah_upload_berkas) {
    row.status = "Belum upload berkas";
  } else if (!row.berkas_verified) {
    row.status = "Menunggu verifikasi berkas";
  } else if (!row.sudah_daftar_jadwal) {
    row.status = "Menunggu pendaftaran jadwal";
  } else if (!row.jadwal_verified) {
    row.status = "Menunggu verifikasi jadwal";
  } else if (!row.punya_penguji) {
    row.status = "Menunggu dosen penguji";
  } else if (!row.punya_surat) {
    row.status = "Menunggu surat penguji";
  } else if (!row.ujian_selesai) {
    row.status = "Menunggu ujian selesai";
  } else {
    row.status = "Selesai";
  }

  return row;
}

/**
 * ============================================================
 * 📊 MODEL UTAMA: STATUS
 * ============================================================
 */
const Status = {
  
  /**
   * 👤 1. STATUS PER MAHASISWA
   * Mengambil status terbaru untuk satu mahasiswa dan mengupdate tabel daftar_ujian.
   */
  async getStatusMahasiswaByNPM(npm) {
    try {
      const query = `
        SELECT 
          m.id AS mahasiswa_id,
          m.npm,
          m.nama,
          COUNT(b.id) > 0 AS sudah_upload_berkas,
          BOOL_OR(bu.status_verifikasi) AS berkas_verified,
          COUNT(j.id) > 0 AS sudah_daftar_jadwal,
          BOOL_OR(j.status_verifikasi) AS jadwal_verified,
          COUNT(DISTINCT du.dosen_penguji_id) > 0 AS punya_penguji,
          COUNT(DISTINCT du.surat_id) > 0 AS punya_surat,
          BOOL_OR(du.ujian_selesai) AS ujian_selesai
        FROM mahasiswa m
        LEFT JOIN berkas b ON b.mahasiswa_id = m.id
        LEFT JOIN berkas_ujian bu ON bu.berkas_id = b.id
        LEFT JOIN jadwal j ON j.mahasiswa_id = m.id
        LEFT JOIN daftar_ujian du ON du.mahasiswa_id = m.id
        WHERE m.npm = $1
        GROUP BY m.id;
      `;

      const result = await pool.query(query, [npm]);
      if (!result.rows.length) return null;

      // Jalankan logika penentuan label status
      const row = getOverallStatus(result.rows[0]);

      // 🔁 Sinkronisasi otomatis ke tabel daftar_ujian
      await pool.query(
        `UPDATE daftar_ujian 
         SET status_pendaftaran = $1 
         WHERE mahasiswa_id = $2`,
        [row.status, row.mahasiswa_id]
      );

      return row;
    } catch (err) {
      console.error('❌ Error getStatusMahasiswaByNPM:', err);
      throw err;
    }
  },

  /**
   * 👥 2. STATUS SEMUA MAHASISWA (BULK)
   * Digunakan untuk monitoring admin dan sinkronisasi massal.
   */
  async getAllStatusMahasiswa() {
    try {
      const query = `
        SELECT 
          m.id AS mahasiswa_id,
          m.npm,
          m.nama,
          COUNT(b.id) > 0 AS sudah_upload_berkas,
          BOOL_OR(bu.status_verifikasi) AS berkas_verified,
          COUNT(j.id) > 0 AS sudah_daftar_jadwal,
          BOOL_OR(j.status_verifikasi) AS jadwal_verified,
          COUNT(DISTINCT du.dosen_penguji_id) > 0 AS punya_penguji,
          COUNT(DISTINCT du.surat_id) > 0 AS punya_surat,
          BOOL_OR(du.ujian_selesai) AS ujian_selesai
        FROM mahasiswa m
        LEFT JOIN berkas b ON b.mahasiswa_id = m.id
        LEFT JOIN berkas_ujian bu ON bu.berkas_id = b.id
        LEFT JOIN jadwal j ON j.mahasiswa_id = m.id
        LEFT JOIN daftar_ujian du ON du.mahasiswa_id = m.id
        GROUP BY m.id
        ORDER BY m.npm ASC;
      `;

      const result = await pool.query(query);
      const rows = result.rows.map(getOverallStatus);

      // 🔁 Update semua status secara paralel (Optimasi Performa)
      const updatePromises = rows.map((r) =>
        pool.query(
          `UPDATE daftar_ujian 
           SET status_pendaftaran = $1 
           WHERE mahasiswa_id = $2`,
          [r.status, r.mahasiswa_id]
        )
      );
      await Promise.all(updatePromises);

      return rows;
    } catch (err) {
      console.error('❌ Error getAllStatusMahasiswa:', err);
      throw err;
    }
  }
};

module.exports = { Status };