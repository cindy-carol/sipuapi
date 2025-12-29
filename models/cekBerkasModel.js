const pool = require('../config/db.js');

const CekBerkasModel = {

  // 1️⃣ Ambil daftar semua mahasiswa
  getMahasiswaList: async () => {
    const res = await pool.query(`
      SELECT id, nama, npm, tahun_ajaran_id 
      FROM mahasiswa 
      ORDER BY npm
    `);
    return res.rows;
  },

  // 2️⃣ Ambil mahasiswa berdasarkan NPM
  getMahasiswaByNpm: async (npm) => {
    const res = await pool.query(`
      SELECT * FROM mahasiswa WHERE npm = $1
    `, [npm]);
    return res.rows[0];
  },

  // 3️⃣ Ambil semua berkas, di-map per mahasiswa
  getBerkasList: async () => {
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
        // ✅ TAMBAHAN: Masukkan catatan kesalahan ke list biar bisa dibaca frontend
        catatan_kesalahan: b.catatan_kesalahan || null 
      });
    });

    return map;
  },

  // 4️⃣ Update status untuk satu berkas (PER FILE)
  // ✅ UPDATE: Menerima parameter 'catatan'
  updateStatus: async (id, status, catatan = null, adminId = null) => {
    // Pastikan status jadi boolean
    const statusBool = (status === 'true' || status === true);

    // Logic: Kalau Valid (true) -> Hapus catatan (null). Kalau Ditolak (false) -> Simpan catatan.
    const fixCatatan = statusBool ? null : catatan;

    console.log(`🟢 Update status berkas_id=${id} → Status: ${statusBool}, Catatan: ${fixCatatan}`);

    await pool.query(`
          UPDATE berkas_ujian
          SET status_verifikasi = $1, 
              catatan_kesalahan = $2,
              verified_by = $3,
              verified_at = NOW()
          WHERE berkas_id = $4
        `, [statusBool, fixCatatan, adminId, id]);
  },

  // 5️⃣ Update semua berkas milik mahasiswa (pengembalian GLOBAL)
updateBerkasStatus: async ({ mahasiswaId, status, catatan_kesalahan = null, adminId = null }) => {
    let statusValue = (status === true || status === 'true') ? true : false;

    await pool.query(`
      UPDATE berkas_ujian 
      SET status_verifikasi = $1, 
          catatan_kesalahan = $2,
          verified_by = $3,
          verified_at = NOW()
      WHERE berkas_id IN (SELECT id FROM berkas WHERE mahasiswa_id = $4)
    `, [statusValue, catatan_kesalahan, adminId, mahasiswaId]);
  },

  // 6️⃣ Ambil satu berkas by ID
  getBerkasById: async (id) => {
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
  },

};

module.exports = CekBerkasModel;