// models/adminDashboardModel.js
const pool = require('../config/db'); // ⚠️ Pastikan path ini sesuai lokasi file database.js kamu
const bcrypt = require('bcrypt');

/**
 * ====================================================================
 * 👤 MODEL: ADMIN LOGIN
 * ====================================================================
 */
const Admin = {
  findByUsername: async (username) => {
    const res = await pool.query(
      `SELECT * FROM akun WHERE username = $1 AND role = 'admin' AND status_aktif = true`,
      [username]
    );
    return res.rows[0] || null;
  },

  checkPassword: async (username, plainPassword) => {
    const admin = await Admin.findByUsername(username);
    if (!admin) return false;
    const match = await bcrypt.compare(plainPassword, admin.password);
    return match ? admin : false;
  },
};

/**
 * ====================================================================
 * 📊 MODEL: DASHBOARD (STATISTIK & RINCIAN)
 * ====================================================================
 */
const Dashboard = {

  /* --- 1️⃣ MANAJEMEN INFORMASI / RINCIAN --- */

  // Mengambil data untuk posisi spesifik (biasanya digunakan di Dashboard Mahasiswa)
  getRincianByIds: async (id1, id2) => {
    try {
      const res = await pool.query(
        `SELECT id, judul, keterangan FROM rincian WHERE id = $1 OR id = $2`,
        [id1, id2]
      );
      return res.rows;
    } catch (err) {
      console.error('❌ ERROR getRincianByIds:', err);
      return [];
    }
  },

  // Mengambil seluruh rincian untuk Dashboard Admin (Editable Cards)
  getAllRincian: async () => {
    try {
      const result = await pool.query(`SELECT * FROM rincian ORDER BY id DESC`);
      return result.rows;
    } catch (error) {
      console.error("❌ Error getAllRincian:", error);
      return [];
    }
  },

  // Menambah Rincian baru
  addRincian: async (judul, keterangan, userId) => {
    const query = `
      INSERT INTO rincian (judul, keterangan, lokasi_card, edited_by, edited_at)
      VALUES ($1, $2, 'dashboard', $3, NOW())
    `;
    return await pool.query(query, [judul, keterangan, userId]);
  },

  // Mengubah data Rincian
  updateRincian: async (id, judul, keterangan, userId) => {
    const query = `
      UPDATE rincian 
      SET judul = $1, keterangan = $2, edited_by = $3, edited_at = NOW() 
      WHERE id = $4
    `;
    return await pool.query(query, [judul, keterangan, userId, id]);
  },


  /* --- 2️⃣ STATISTIK UTAMA & RINGKASAN --- */

  // Mendapatkan angka statistik utama (Angka di kartu putih atas)
  getRingkasanMahasiswa: async (tahunId = null) => {
    let query = `
      SELECT
        COUNT(DISTINCT m.id) AS "jumlahMahasiswa",
        COUNT(DISTINCT CASE WHEN d.id IS NULL THEN m.id END) AS "belumDaftar",
        COUNT(DISTINCT CASE WHEN d.surat_id IS NOT NULL THEN m.id END) AS "menungguUjian",
        COUNT(DISTINCT CASE WHEN d.ujian_selesai = true THEN m.id END) AS "sudahUjian"
      FROM mahasiswa m
      LEFT JOIN daftar_ujian d ON m.id = d.mahasiswa_id
    `;
    const values = [];
    if (tahunId) {
      query += ` WHERE m.tahun_ajaran_id = $1`;
      values.push(tahunId);
    }
    const result = await pool.query(query, values);
    const row = result.rows[0];
    return {
      jumlahMahasiswa: parseInt(row.jumlahMahasiswa || 0),
      belumDaftar: parseInt(row.belumDaftar || 0),
      menungguUjian: parseInt(row.menungguUjian || 0),
      sudahUjian: parseInt(row.sudahUjian || 0)
    };
  },

  /* --- 3️⃣ DATA CHART (GRAFIK) --- */

  // Data untuk Bar Chart (Status Pendaftaran)
  getBarChart: async (tahunId = null) => {
    let query = `
      SELECT 
        COUNT(DISTINCT CASE WHEN du.id IS NULL THEN m.id END) AS belum,
        COUNT(DISTINCT CASE WHEN du.ujian_selesai = false THEN m.id END) AS sedang_daftar,
        COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN m.id END) AS siap_ujian,
        COUNT(DISTINCT CASE WHEN du.status_keseluruhan = true THEN m.id END) AS selesai
      FROM mahasiswa m
      LEFT JOIN daftar_ujian du ON du.mahasiswa_id = m.id
      LEFT JOIN surat s ON s.mahasiswa_id = m.id
    `;
    const params = [];
    if (tahunId) {
      query += ` WHERE m.tahun_ajaran_id = $1 `;
      params.push(tahunId);
    }
    const result = await pool.query(query, params);
    const data = result.rows[0];
    return [
      { label: 'Belum Daftar', jumlah: parseInt(data.belum || 0) },
      { label: 'Proses Daftar', jumlah: parseInt(data.sedang_daftar || 0) },
      { label: 'Menunggu Ujian', jumlah: parseInt(data.siap_ujian || 0) },
      { label: 'Selesai', jumlah: parseInt(data.selesai || 0) }
    ];
  },

  // Data untuk Pie Chart (Tahapan Verifikasi)
  getPieChart: async (tahunId = null) => {
    const params = [];
    let whereClause = "";
    if (tahunId) {
      whereClause = "AND m.tahun_ajaran_id = $1";
      params.push(tahunId);
    }
    
    // Eksekusi paralel agar lebih efisien
    const [berkasRes, jadwalRes, pengujiRes, suratRes] = await Promise.all([
      pool.query(`SELECT COUNT(DISTINCT bu.daftar_ujian_id) AS jumlah FROM berkas_ujian bu JOIN daftar_ujian du ON du.id = bu.daftar_ujian_id JOIN mahasiswa m ON m.id = du.mahasiswa_id WHERE 1=1 ${whereClause}`, params),
      pool.query(`SELECT COUNT(DISTINCT du.id) AS jumlah FROM daftar_ujian du JOIN jadwal j ON j.id = du.jadwal_id JOIN mahasiswa m ON m.id = du.mahasiswa_id WHERE 1=1 ${whereClause}`, params),
      pool.query(`SELECT COUNT(*) AS jumlah FROM dosen_penguji dp JOIN mahasiswa m ON m.id = dp.mahasiswa_id WHERE dp.status_verifikasi = FALSE ${whereClause}`, params),
      pool.query(`SELECT COUNT(*) AS jumlah FROM surat s JOIN mahasiswa m ON m.id = s.mahasiswa_id WHERE 1=1 ${whereClause}`, params)
    ]);

    return {
      upload_berkas: parseInt(berkasRes.rows[0].jumlah || 0),
      upload_jadwal: parseInt(jadwalRes.rows[0].jumlah || 0),
      tunggu_penguji: parseInt(pengujiRes.rows[0].jumlah || 0),
      surat_terbit: parseInt(suratRes.rows[0].jumlah || 0)
    };
  },

  // Mendapatkan statistik warna-warni (Ringkasan Detail)
  getStatistikRingkas: async (tahunId = null) => {
    const data = await Dashboard.getPieChart(tahunId);
    return [
      { label: "Upload Berkas", jumlah: data.upload_berkas, bg: "bg-danger", key: "upload_berkas" },
      { label: "Upload Jadwal", jumlah: data.upload_jadwal, bg: "bg-danger", key: "upload_jadwal" },
      { label: "Tunggu Verifikasi Penguji", jumlah: data.tunggu_penguji, bg: "bg-info", key: "tunggu_penguji" },
      { label: "Surat Diterbitkan", jumlah: data.surat_terbit, bg: "bg-success", key: "surat_terbit" },
    ];
  },

  /* --- 4️⃣ BREAKDOWN DATA PER TAHUN AJARAN --- */

  // Mendapatkan ringkasan statistik komprehensif untuk setiap tahun ajaran
  getStatistikLengkapPerTahun: async () => {
    try {
      const query = `
        SELECT 
          ta.id,
          (ta.nama_tahun || ' ' || ta.semester) AS label,
          
          -- Data Kartu Utama
          COUNT(DISTINCT m.id) AS total_mhs,
          COUNT(DISTINCT CASE WHEN du.id IS NULL THEN m.id END) AS belum_daftar,
          COUNT(DISTINCT CASE WHEN du.surat_id IS NOT NULL THEN m.id END) AS menunggu_ujian,
          COUNT(DISTINCT CASE WHEN du.ujian_selesai = true THEN m.id END) AS sudah_ujian,

          -- Data Tahapan Verifikasi
          COUNT(DISTINCT CASE WHEN bu.daftar_ujian_id IS NOT NULL THEN m.id END) AS upload_berkas,
          COUNT(DISTINCT CASE WHEN j.id IS NOT NULL THEN m.id END) AS upload_jadwal,
          COUNT(DISTINCT CASE WHEN dp.status_verifikasi = FALSE THEN m.id END) AS tunggu_penguji,
          COUNT(DISTINCT s.id) AS surat_terbit

        FROM tahun_ajaran ta
        LEFT JOIN mahasiswa m ON m.tahun_ajaran_id = ta.id
        LEFT JOIN daftar_ujian du ON du.mahasiswa_id = m.id
        LEFT JOIN berkas_ujian bu ON bu.daftar_ujian_id = du.id
        LEFT JOIN jadwal j ON j.id = du.jadwal_id
        LEFT JOIN dosen_penguji dp ON dp.mahasiswa_id = m.id
        LEFT JOIN surat s ON s.mahasiswa_id = m.id
        
        GROUP BY ta.id, ta.nama_tahun, ta.semester
        ORDER BY ta.nama_tahun DESC, ta.semester DESC
      `;
      const result = await pool.query(query);
      return result.rows;
    } catch (err) {
      console.error("❌ Error getStatistikLengkapPerTahun:", err);
      return []; 
    }
  },

  // Mendapatkan daftar Tahun Ajaran untuk Dropdown Filter
  getTahunAjarList: async () => {
    const result = await pool.query(`SELECT id, nama_tahun || ' ' || semester AS label FROM tahun_ajaran ORDER BY id DESC`);
    return result.rows;
  }
};

module.exports = { Admin, Dashboard };