// models/mahasiswaModel.js
const pool = require('../config/db');

/**
 * ==========================================================
 * 🎓 MODEL: MAHASISWA
 * ==========================================================
 * Mengelola data master mahasiswa, integrasi akun otomatis,
 * serta pemantauan status akademik (berkas & jadwal).
 */
const Mahasiswa = {

  /* ==========================================================
   * 🧩 1. CRUD DASAR (MANAJEMEN DATA)
   * ========================================================== */

  // Ambil profil lengkap mahasiswa berdasarkan NPM
// Ambil profil lengkap mahasiswa beserta nama dosen pembimbing
findByNPM: async (npm) => {
  try {
    const res = await pool.query(
      `
      SELECT m.*, t.nama_tahun, t.semester,
             d1.nama AS nama_dosbing1, 
             d2.nama AS nama_dosbing2
      FROM mahasiswa m
      LEFT JOIN tahun_ajaran t ON m.tahun_ajaran_id = t.id
      LEFT JOIN dosen d1 ON m.dosbing1_id = d1.id
      LEFT JOIN dosen d2 ON m.dosbing2_id = d2.id
      WHERE m.npm = $1
      `,
      [npm]
    );
    return res.rows[0] || null;
  } catch (err) {
    console.error('❌ ERROR findByNPM:', err);
    throw err;
  }
},

  // Ambil data mahasiswa dengan info Tahun Ajaran & Dosbing (Filterable)
  getAll: async (tahunId = null) => {
    try {
      const params = [];
      let query = `
        SELECT 
          m.npm, m.nama, t.nama_tahun, t.semester,
          d1.nama AS dosbing1, d2.nama AS dosbing2
        FROM mahasiswa m
        LEFT JOIN tahun_ajaran t ON m.tahun_ajaran_id = t.id
        LEFT JOIN dosen d1 ON m.dosbing1_id = d1.id
        LEFT JOIN dosen d2 ON m.dosbing2_id = d2.id
      `;

      if (tahunId) {
        query += ' WHERE m.tahun_ajaran_id = $1';
        params.push(tahunId);
      }

      query += ' ORDER BY m.id';

      const res = await pool.query(query, params);
      return res.rows;
    } catch (err) {
      console.error('❌ ERROR getAll:', err);
      throw err;
    }
  },

  // Tambah mahasiswa baru sekaligus buat akun otomatis
  create: async ({ npm, nama, tahun_ajaran_id }) => {
    try {
      // Buat akun otomatis dulu (NPM sebagai username)
      const akun = await Mahasiswa.createAkunOtomatis(npm);

      const res = await pool.query(
        `
        INSERT INTO mahasiswa (npm, nama, tahun_ajaran_id, akun_id)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [npm, nama, tahun_ajaran_id, akun?.id || null]
      );

      console.log(`✅ Mahasiswa ${nama} (${npm}) berhasil ditambahkan.`);
      return res.rows[0];
    } catch (err) {
      console.error('❌ ERROR create mahasiswa:', err);
      throw err;
    }
  },

  // Update data mahasiswa (NPM, Nama, atau Tahun Ajaran)
  updateByNpm: async (npmLama, { npm, nama, tahun_ajaran_id }) => {
    try {
      const res = await pool.query(
        `
        UPDATE mahasiswa
        SET npm = $1, nama = $2, tahun_ajaran_id = $3
        WHERE npm = $4
        RETURNING *
        `,
        [npm, nama, tahun_ajaran_id, npmLama]
      );
      return res.rows[0];
    } catch (err) {
      console.error('❌ ERROR updateByNpm:', err);
      throw err;
    }
  },

  // Hapus data mahasiswa
  removeByNpm: async (npm) => {
    try {
      const res = await pool.query(`DELETE FROM mahasiswa WHERE npm = $1`, [npm]);
      return res; 
    } catch (err) {
      console.error('❌ ERROR removeByNpm:', err);
      throw err;
    }
  },

  /* ==========================================================
   * 📆 2. TAHUN AJARAN / FILTER LOGIC
   * ========================================================== */

  getTahunAjarList: async () => {
    try {
      const res = await pool.query(`
        SELECT DISTINCT ON (nama_tahun, semester) 
          id, nama_tahun, semester 
        FROM tahun_ajaran 
        ORDER BY nama_tahun DESC, semester DESC, id DESC
      `);
      return res.rows;
    } catch (err) {
      console.error('❌ ERROR getTahunAjarList:', err);
      throw err;
    }
  },

  getTahunTerbaru: async () => {
    try {
      const res = await pool.query(`
        SELECT id FROM tahun_ajaran ORDER BY id DESC LIMIT 1
      `);
      return res.rows[0]?.id || null;
    } catch (err) {
      console.error('❌ ERROR getTahunTerbaru:', err);
      throw err;
    }
  },

  /* ==========================================================
   * 📁 3. MONITORING STATUS BERKAS & UJIAN
   * ========================================================== */

  // Digunakan untuk mewarnai indikator progress di dashboard mahasiswa (Merah/Kuning/Hijau)
  getStatusBerkasByNPM: async (npm) => {
    const res = await pool.query(`
      SELECT
        b.jenis_berkas,
        CASE 
          WHEN bu.status_verifikasi = TRUE THEN 3 -- Hijau (ACC)
          WHEN bu.status_verifikasi = FALSE AND bu.catatan_kesalahan IS NOT NULL THEN 2 -- Merah (Ditolak)
          WHEN b.id IS NOT NULL AND bu.status_verifikasi IS NULL THEN 1 -- Kuning (Menunggu)
          ELSE 0 -- Abu (Belum Upload)
        END as status_code
      FROM mahasiswa m
      LEFT JOIN berkas b ON m.id = b.mahasiswa_id
      LEFT JOIN berkas_ujian bu ON b.id = bu.berkas_id
      WHERE m.npm = $1
    `, [npm]);

    const status = { rpl: 0, artikel: 0, kartu_asistensi_1: 0, kartu_asistensi_2: 0, kartu_asistensi_3: 0 };
    res.rows.forEach(row => {
      if (row.jenis_berkas === 'dokumen_rpl') status.rpl = row.status_code;
      if (row.jenis_berkas === 'draft_artikel') status.artikel = row.status_code;
      if (row.jenis_berkas === 'kartu_asistensi_1') status.kartu_asistensi_1 = row.status_code;
      if (row.jenis_berkas === 'kartu_asistensi_2') status.kartu_asistensi_2 = row.status_code;
      if (row.jenis_berkas === 'kartu_asistensi_3') status.kartu_asistensi_3 = row.status_code;
    });
    return status;
  },

  // Mengambil jadwal aktif mahasiswa (untuk dashboard atau cetak surat)
  getJadwalUjianByNPM: async (npm) => {
    const res = await pool.query(`
      SELECT 
        j.id AS jadwal_id, j.tanggal, j.jam_mulai, j.jam_selesai, j.pelaksanaan, j.tempat,
        j.status_verifikasi, j.is_edited, d.id AS daftar_ujian_id, d.status_keseluruhan, d.ujian_selesai
      FROM jadwal j
      JOIN mahasiswa m ON j.mahasiswa_id = m.id
      LEFT JOIN daftar_ujian d ON d.jadwal_id = j.id
      WHERE m.npm = $1
      ORDER BY j.tanggal DESC, j.jam_mulai ASC
    `, [npm]);
    return res.rows;
  },

  // Mendapatkan path file surat undangan yang sudah diterbitkan
  getSuratByNPM: async (npm) => {
    try {
      const res = await pool.query(
        `SELECT s.path_file FROM surat s JOIN mahasiswa m ON s.mahasiswa_id = m.id WHERE m.npm = $1`, 
        [String(npm)]
      );
      return res.rows[0] || null;
    } catch (err) {
      console.error('❌ ERROR getSuratByNPM:', err);
      throw err;
    }
  },

  /* ==========================================================
   * 👤 4. AKUN OTOMATIS (AUTH INTEGRATION)
   * ========================================================== */
  createAkunOtomatis: async (npm) => {
    try {
      const cek = await pool.query('SELECT id FROM akun WHERE username = $1', [npm]);
      if (cek.rows.length > 0) return cek.rows[0];

      const result = await pool.query(
        `INSERT INTO akun (username, role, status_aktif) VALUES ($1, 'mahasiswa', TRUE) RETURNING id, username, role`,
        [npm]
      );
      console.log(`🧾 Akun otomatis dibuat untuk: ${npm}`);
      return result.rows[0];
    } catch (err) {
      console.error('❌ ERROR createAkunOtomatis:', err);
      throw err;
    }
  },

  /* ==========================================================
   * 📊 5. STATISTIK DASHBOARD
   * ========================================================== */

  getRingkasanMahasiswa: async () => {
    const res = await pool.query(`
      SELECT
        COUNT(*) AS jumlah_mahasiswa,
        COUNT(*) FILTER (WHERE status_daftar='belum_daftar') AS belum_daftar,
        COUNT(*) FILTER (WHERE status_daftar='menunggu_ujian') AS menunggu_ujian,
        COUNT(*) FILTER (WHERE status_daftar='sudah_ujian') AS sudah_ujian
      FROM mahasiswa
    `);
    const row = res.rows[0];
    return {
      jumlahMahasiswa: parseInt(row.jumlah_mahasiswa, 10),
      belumDaftar: parseInt(row.belum_daftar, 10),
      menungguUjian: parseInt(row.menunggu_ujian, 10),
      sudahUjian: parseInt(row.sudah_ujian, 10),
    };
  },

  getAllRincian: async () => {
    const result = await pool.query(`SELECT * FROM rincian ORDER BY id ASC`);
    return result.rows;
  },
};

module.exports = { Mahasiswa };