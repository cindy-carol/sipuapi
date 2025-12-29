// models/CekBerkasModel.js
const pool = require('../config/db');

/**
 * ============================================================
 * 📁 MODEL: CEK BERKAS (VERIFIKASI ADMIN)
 * ============================================================
 * Mengelola alur verifikasi berkas pendaftaran ujian mahasiswa.
 */
const CekBerkasModel = {

  // 1️⃣ Ambil daftar singkat seluruh mahasiswa untuk table list monitoring
  getMahasiswaList: async () => {
    try {
      const res = await pool.query(`
        SELECT id, nama, npm, tahun_ajaran_id 
        FROM mahasiswa 
        ORDER BY npm
      `);
      return res.rows;
    } catch (err) {
      console.error('❌ Error getMahasiswaList:', err);
      return [];
    }
  },

  // 2️⃣ Ambil profil mahasiswa berdasarkan NPM
  getMahasiswaByNpm: async (npm) => {
    const res = await pool.query(`
      SELECT * FROM mahasiswa WHERE npm = $1
    `, [npm]);
    return res.rows[0];
  },

  // 3️⃣ Ambil seluruh berkas dan diorganisir (mapped) berdasarkan ID Mahasiswa
  getBerkasList: async () => {
    try {
      const res = await pool.query(`
        SELECT 
          b.id, b.mahasiswa_id, b.jenis_berkas, b.nama_berkas, 
          b.path_file, b.tanggal_upload, b.is_edited,
          bu.status_verifikasi,
          bu.catatan_kesalahan
        FROM berkas b
        LEFT JOIN berkas_ujian bu ON bu.berkas_id = b.id
        ORDER BY b.mahasiswa_id, b.tanggal_upload ASC
      `);

      const map = {};
      
      res.rows.forEach(b => {
        if (!map[b.mahasiswa_id]) map[b.mahasiswa_id] = [];

        map[b.mahasiswa_id].push({
          id: b.id,
          jenis_berkas: b.jenis_berkas,
          nama_berkas: b.nama_berkas,
          path_file: b.path_file,
          tanggal_upload: b.tanggal_upload,
          is_edited: b.is_edited,
          status_verifikasi: b.status_verifikasi,
          catatan_kesalahan: b.catatan_kesalahan || null 
        });
      });

      return map;
    } catch (err) {
      console.error('❌ Error getBerkasList:', err);
      return {};
    }
  },

  // 4️⃣ Update status verifikasi untuk SATU berkas (Single File)
  updateStatus: async (id, status, catatan = null, adminId = null) => {
    // Konversi input ke boolean murni
    const statusBool = (status === 'true' || status === true);

    // Logic: Jika Valid (true) -> Catatan dikosongkan. Jika Ditolak (false) -> Simpan alasan penolakan.
    const fixCatatan = statusBool ? null : catatan;

    await pool.query(`
      UPDATE berkas_ujian
      SET status_verifikasi = $1, 
          catatan_kesalahan = $2,
          verified_by = $3,
          verified_at = NOW()
      WHERE berkas_id = $4
    `, [statusBool, fixCatatan, adminId, id]);
  },

  // 5️⃣ Update status verifikasi SEMUA berkas milik satu mahasiswa (Bulk/Global)
  updateBerkasStatus: async ({ mahasiswaId, status, catatan_kesalahan = null, adminId = null }) => {
    const statusValue = (status === true || status === 'true');

    await pool.query(`
      UPDATE berkas_ujian 
      SET status_verifikasi = $1, 
          catatan_kesalahan = $2,
          verified_by = $3,
          verified_at = NOW()
      WHERE berkas_id IN (SELECT id FROM berkas WHERE mahasiswa_id = $4)
    `, [statusValue, catatan_kesalahan, adminId, mahasiswaId]);
  },

  // 6️⃣ Ambil detail informasi satu berkas berdasarkan ID
  getBerkasById: async (id) => {
    try {
      const res = await pool.query(`
        SELECT 
          b.id, b.mahasiswa_id, b.jenis_berkas,
          b.nama_berkas, b.path_file, b.tanggal_upload, b.is_edited,
          bu.status_verifikasi, bu.catatan_kesalahan
        FROM berkas b
        LEFT JOIN berkas_ujian bu ON bu.berkas_id = b.id
        WHERE b.id = $1
      `, [id]);

      if (!res.rows[0]) return null;

      const b = res.rows[0];
      return {
        id: b.id,
        mahasiswa_id: b.mahasiswa_id,
        jenis_berkas: b.jenis_berkas,
        nama_berkas: b.nama_berkas,
        path_file: b.path_file,
        tanggal_upload: b.tanggal_upload,
        is_edited: b.is_edited,
        status_verifikasi: b.status_verifikasi,
        catatan_kesalahan: b.catatan_kesalahan || null
      };
    } catch (err) {
      console.error('❌ Error getBerkasById:', err);
      return null;
    }
  },

};

module.exports = CekBerkasModel;