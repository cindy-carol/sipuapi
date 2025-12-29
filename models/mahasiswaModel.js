const pool = require('../config/db');

const Mahasiswa = {
  /* ==========================================================
   * 🧩  CRUD DASAR
   * ========================================================== */
  findByNPM: async (npm) => {
    try {
      const res = await pool.query(
        `
        SELECT m.*, t.nama_tahun, t.semester
        FROM mahasiswa m
        LEFT JOIN tahun_ajaran t ON m.tahun_ajaran_id = t.id
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


  create: async ({ npm, nama, tahun_ajaran_id }) => {
    try {
      // Buat akun otomatis dulu (tanpa password)
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

update: async ({ npm, nama, nama_tahun, semester }) => {
    try {
        // 1. Cari ID Tahun Ajaran dari Model TahunAjaran
        const ta = await TahunAjaran.findByNamaDanSemester(nama_tahun, semester);

        if (!ta) {
            // Jika data Year/Semester tidak ada di DB, lempar error
            throw new Error('Tahun Ajaran tidak valid atau tidak ditemukan.');
        }
        
        // Ambil ID yang diperlukan untuk update di tabel mahasiswa
        const tahun_ajaran_id = ta.id; 

const res = await pool.query(
`
UPDATE mahasiswa
SET nama = $2, tahun_ajaran_id = $3
WHERE npm = $1
RETURNING *
`,
[npm, nama, tahun_ajaran_id]
);
return res.rows[0];
 } catch (err) {
console.error('❌ ERROR update mahasiswa:', err);
throw err;
}
},


  /* ==========================================================
   * 📆  TAHUN AJARAN / FILTER
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
        SELECT id
        FROM tahun_ajaran
        ORDER BY id DESC
        LIMIT 1
      `);
      return res.rows[0]?.id || null;
    } catch (err) {
      console.error('❌ ERROR getTahunTerbaru:', err);
      throw err;
    }
  },

  getRingkasanMahasiswaByTahun: async (tahunId = null) => {
    try {
      const res = await pool.query(
        `
        SELECT
          COUNT(*) AS jumlah_mahasiswa,
          COUNT(*) FILTER (WHERE status_daftar='belum_daftar') AS belum_daftar,
          COUNT(*) FILTER (WHERE status_daftar='menunggu_ujian') AS menunggu_ujian,
          COUNT(*) FILTER (WHERE status_daftar='sudah_ujian') AS sudah_ujian
        FROM mahasiswa
        WHERE ($1::int IS NULL OR tahun_ajaran_id = $1)
        `,
        [tahunId]
      );

      const row = res.rows[0];
      return {
        jumlahMahasiswa: parseInt(row.jumlah_mahasiswa, 10),
        belumDaftar: parseInt(row.belum_daftar, 10),
        menungguUjian: parseInt(row.menunggu_ujian, 10),
        sudahUjian: parseInt(row.sudah_ujian, 10),
      };
    } catch (err) {
      console.error('❌ ERROR getRingkasanMahasiswaByTahun:', err);
      throw err;
    }
  },

    /* ==========================================================
   * 📢  INFORMASI (DARI ADMIN) - FITUR BARU
   * ========================================================== */

    getAllRincian: async () => {
      try {
        // Pakai SELECT * biar aman, semua kolom (id, judul, keterangan) keambil
        const result = await pool.query(`SELECT * FROM rincian ORDER BY id ASC`);
        return result.rows;
      } catch (error) {
        console.error("❌ Error getAllRincian:", error);
        return [];
      }
    },

    // 1. Tambahkan getByNpm (Method ini akan digunakan Controller untuk merge data sebelum update)
    getByNpm: async (npm) => {
      try {
        const res = await pool.query(
          `
          SELECT m.npm, m.nama, m.tahun_ajaran_id, m.id 
          FROM mahasiswa m
          WHERE m.npm = $1
          `,
          [npm]
        );
        return res.rows[0] || null;
      } catch (err) {
        console.error('❌ ERROR getByNpm:', err);
        throw err;
      }
    },

    // 2. Modifikasi update menjadi updateByNpm (menggantikan update yang lama)
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
          // $1, $2, $3 adalah data baru, $4 adalah kunci NPM lama
        );
        return res.rows[0];
      } catch (err) {
        console.error('❌ ERROR updateByNpm:', err);
        throw err;
      }
    },

    // 3. Tambahkan removeByNpm (Untuk Delete)
    removeByNpm: async (npm) => {
      try {
        const res = await pool.query(`DELETE FROM mahasiswa WHERE npm = $1`, [npm]);
        return res; // Mengembalikan hasil query untuk cek rowCount
      } catch (err) {
        console.error('❌ ERROR removeByNpm:', err);
        throw err;
      }
    },

  /* ==========================================================
   * 👤  AKUN OTOMATIS TANPA PASSWORD
   * ========================================================== */
  createAkunOtomatis: async (npm) => {
    try {
      const cek = await pool.query('SELECT id FROM akun WHERE username = $1', [npm]);
      if (cek.rows.length > 0) {
        console.log(`⚠️ Akun untuk ${npm} sudah ada, dilewati.`);
        return cek.rows[0];
      }

      const result = await pool.query(
        `
        INSERT INTO akun (username, role, status_aktif)
        VALUES ($1, 'mahasiswa', TRUE)
        RETURNING id, username, role
        `,
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
   * 📊  DASHBOARD & DATA TAMBAHAN
   * ========================================================== */
getMahasiswaByNPM: async (npm) => {
    try {
      const res = await pool.query(
        `
        SELECT m.npm, m.nama, t.nama_tahun, t.semester,
               d1.nama AS dosbing1, d1.id AS dosbing1_id,
               d2.nama AS dosbing2, d2.id AS dosbing2_id
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
      console.error('❌ ERROR getMahasiswaByNPM:', err);
      throw err;
    }
  },

  getRingkasanMahasiswa: async () => {
    try {
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
    } catch (err) {
      console.error('❌ ERROR getRingkasanMahasiswa:', err);
      throw err;
    }
  },

  getMahasiswaByTahun: async (tahunId) => {
    try {
      let query = 'SELECT * FROM mahasiswa';
      const params = [];

      if (tahunId) {
        query += ' WHERE tahun_ajaran_id = $1';
        params.push(tahunId);
      }

      const { rows } = await pool.query(query, params);
      return rows;
    } catch (err) {
      console.error('❌ ERROR getMahasiswaByTahun:', err);
      throw err;
    }
  },

// models/mahasiswaModel.js
// models/mahasiswaModel.js
getStatusBerkasByNPM: async (npm) => {
  const res = await pool.query(`
    SELECT
      b.jenis_berkas,
      CASE 
        -- 1. Diterima (Hijau)
        WHEN bu.status_verifikasi = TRUE THEN 3 
        
        -- 2. Ditolak / Perlu Revisi (Merah)
        -- Jika status_verifikasi false DAN ada catatan dari admin
        WHEN bu.status_verifikasi = FALSE AND bu.catatan_kesalahan IS NOT NULL THEN 2 
        
        -- 3. Menunggu (Kuning)
        -- Berkas ada, tapi belum diproses admin (status_verifikasi masih NULL)
        WHEN b.id IS NOT NULL AND bu.status_verifikasi IS NULL THEN 1
        
        -- Default: Belum Ada Berkas
        ELSE 0 
      END as status_code
    FROM mahasiswa m
    LEFT JOIN berkas b ON m.id = b.mahasiswa_id
    LEFT JOIN berkas_ujian bu ON b.id = bu.berkas_id
    WHERE m.npm = $1
  `, [npm]);

  // Mapping hasil query ke object status
  const status = { rpl: 0, artikel: 0, kartu_asistensi_1: 0, kartu_asistensi_2: 0, kartu_asistensi_3: 0 };
  res.rows.forEach(row => {
    if (row.jenis_berkas === 'dokumen_rpl') status.rpl = row.status_code;
    if (row.jenis_berkas === 'draft_artikel') status.artikel = row.status_code;
    if (row.jenis_berkas === 'kartu_asistensi_1') status.kartu_asistensi_1 = row.status_code;
  });
  return status;
},

getJadwalUjianByNPM: async (npm) => {
  const res = await pool.query(`
    SELECT 
      j.id AS jadwal_id,
      j.tanggal,
      j.jam_mulai,
      j.jam_selesai,
      j.pelaksanaan,
      j.tempat,
      j.status_verifikasi,
      j.is_edited,
      j.edited_at,
      d.id AS daftar_ujian_id,
      d.status_keseluruhan,
      d.tanggal_selesai,
      d.ujian_selesai
    FROM jadwal j
    JOIN mahasiswa m ON j.mahasiswa_id = m.id
    LEFT JOIN daftar_ujian d ON d.jadwal_id = j.id
    WHERE m.npm = $1
    ORDER BY j.tanggal DESC, j.jam_mulai ASC
  `, [npm]);

  return res.rows;
},

/* ==========================================================
 * 📩  AMBIL SURAT PAKE JOIN (SOLUSI FINAL)
 * ========================================================== */
getSuratByNPM: async (npm) => {
    try {
      const res = await pool.query(
        `
        SELECT s.path_file 
        FROM surat s
        JOIN mahasiswa m ON s.mahasiswa_id = m.id
        WHERE m.npm = $1
        `, 
        [String(npm)] // Kita amanin NPM jadi String
      );
      
      return res.rows[0] || null;

    } catch (err) {
      console.error('❌ ERROR getSuratByNPM:', err);
      throw err;
    }
}
};

module.exports = { Mahasiswa };
