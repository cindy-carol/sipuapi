// ==========================================
// 📁 models/dashboard/kaprodiDashboardModel.js
// ==========================================
const pool = require('../config/db.js');

// ====================================================================
// 👤 MODEL: KAPRODI DATA
// ====================================================================
const Kaprodi = {
  findByNIP: async (nip) => {
    const res = await pool.query(
      'SELECT * FROM kaprodis WHERE nip_kaprodi = $1',
      [nip]
    );
    return res.rows[0] || null;
  },
};

// ====================================================================
// 📊 MODEL: DASHBOARD KAPRODI
// ====================================================================
const Dashboard = {

  /* =======================================================
   * 1️⃣ RINGKASAN BESAR (Disamakan dengan Admin biar konsisten)
   * ======================================================= */
getRingkasanMahasiswa: async (tahunId = null) => {
    let query = `
      SELECT
        -- Hitung total mahasiswa (unik)
        COUNT(DISTINCT m.id) AS "jumlahMahasiswa",

        -- 1. Belum Daftar: Hitung ID unik jika tidak ada di daftar_ujian
        COUNT(DISTINCT CASE WHEN d.id IS NULL THEN m.id END) AS "belumDaftar",

        -- 2. Menunggu Ujian: Hitung ID unik jika surat_id sudah ada
        COUNT(DISTINCT CASE WHEN d.surat_id IS NOT NULL THEN m.id END) AS "menungguUjian",

        -- 3. Sudah Ujian: Hitung ID unik jika status ujian selesai = true
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
    
    // Return object data (default 0 jika null)
    const row = result.rows[0];
    return {
      jumlahMahasiswa: parseInt(row.jumlahMahasiswa || 0),
      belumDaftar: parseInt(row.belumDaftar || 0),
      menungguUjian: parseInt(row.menungguUjian || 0),
      sudahUjian: parseInt(row.sudahUjian || 0)
    };
  },

  getStatistikLengkapPerTahun: async () => {
      try {
        const query = `
          SELECT 
            ta.id,
            (ta.nama_tahun || ' ' || ta.semester) AS label,
            
            -- 1. Data Kartu Putih
            COUNT(DISTINCT m.id) AS total_mhs,
            COUNT(DISTINCT CASE WHEN du.id IS NULL THEN m.id END) AS belum_daftar,
            COUNT(DISTINCT CASE WHEN du.surat_id IS NOT NULL THEN m.id END) AS menunggu_ujian,
            COUNT(DISTINCT CASE WHEN du.ujian_selesai = true THEN m.id END) AS sudah_ujian,
  
            -- 2. Data Kartu Warna-Warni (Baru)
            -- Upload Berkas (Ada di bu)
            COUNT(DISTINCT CASE WHEN bu.daftar_ujian_id IS NOT NULL THEN m.id END) AS upload_berkas,
            -- Upload Jadwal (Ada di j)
            COUNT(DISTINCT CASE WHEN j.id IS NOT NULL THEN m.id END) AS upload_jadwal,
            -- Tunggu Verifikasi (Ada di dp status false)
            COUNT(DISTINCT CASE WHEN dp.status_verifikasi = FALSE THEN m.id END) AS tunggu_penguji,
            -- Surat Terbit (Ada di s)
            COUNT(DISTINCT s.id) AS surat_terbit
  
          FROM tahun_ajaran ta
          LEFT JOIN mahasiswa m ON m.tahun_ajaran_id = ta.id
          LEFT JOIN daftar_ujian du ON du.mahasiswa_id = m.id
          -- Join tambahan untuk data rinci
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
  /* =======================================================
   * 2️⃣ STATISTIK RINGKAS (Mini Cards Warna-Warni)
   * ======================================================= */
  getStatistikRingkas: async (tahunId = null) => {
    const params = [];
    let whereClause = "";

    if (tahunId) {
      whereClause = "AND m.tahun_ajaran_id = $1";
      params.push(tahunId);
    }

    // Gunakan Promise.all biar query jalan barengan (Lebih Cepat)
    const [berkasRes, jadwalRes, pengujiRes, suratRes] = await Promise.all([
      // 1. Upload Berkas
      pool.query(`
        SELECT COUNT(DISTINCT bu.daftar_ujian_id) AS jumlah
        FROM berkas_ujian bu
        JOIN daftar_ujian du ON du.id = bu.daftar_ujian_id
        JOIN mahasiswa m ON m.id = du.mahasiswa_id
        WHERE 1=1 ${whereClause}
      `, params),

      // 2. Upload Jadwal
      pool.query(`
        SELECT COUNT(DISTINCT du.id) AS jumlah
        FROM daftar_ujian du
        JOIN jadwal j ON j.id = du.jadwal_id
        JOIN mahasiswa m ON m.id = du.mahasiswa_id
        WHERE 1=1 ${whereClause}
      `, params),

      // 3. Tunggu Verifikasi Penguji
      pool.query(`
        SELECT COUNT(DISTINCT dp.mahasiswa_id) AS jumlah
        FROM dosen_penguji dp
        JOIN mahasiswa m ON m.id = dp.mahasiswa_id
        WHERE dp.status_verifikasi = FALSE
        ${whereClause}
      `, params),

      // 4. Surat Diterbitkan
      pool.query(`
        SELECT COUNT(DISTINCT s.mahasiswa_id) AS jumlah
        FROM surat s
        JOIN mahasiswa m ON m.id = s.mahasiswa_id
        WHERE 1=1 ${whereClause}
      `, params)
    ]);

    return [
      { 
        label: "Upload Berkas", 
        jumlah: +berkasRes.rows[0].jumlah || 0, 
        bg: "bg-danger", 
        key: "upload_berkas" // 👈 INI KUNCINYA BIAR TABEL KECIL MUNCUL
      },
      { 
        label: "Upload Jadwal", 
        jumlah: +jadwalRes.rows[0].jumlah || 0, 
        bg: "bg-danger", 
        key: "upload_jadwal" // 👈 Sesuai kolom di getStatistikLengkapPerTahun
      }, 
      { 
        label: "Tunggu Verifikasi Penguji", 
        jumlah: +pengujiRes.rows[0].jumlah || 0, 
        bg: "bg-info", 
        key: "tunggu_penguji" // 👈 Harus sama persis tulisannya
      }, 
      { 
        label: "Surat Diterbitkan", 
        jumlah: +suratRes.rows[0].jumlah || 0, 
        bg: "bg-success", 
        key: "surat_terbit" // 👈 Ini juga
      }, 
    ];
  },

  /* =======================================================
   * 📊 BAR CHART (WAJIB ADA biar ga error saat fetch)
   * ======================================================= */
  getBarChart: async (tahunId = null) => {
    let query = `
      SELECT 
        COUNT(DISTINCT CASE WHEN du.id IS NULL THEN m.id END) AS belum,
        COUNT(DISTINCT CASE WHEN du.status_keseluruhan = false THEN m.id END) AS sudah_daftar,
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
      { label: 'Sudah Daftar (Proses)', jumlah: parseInt(data.sudah_daftar || 0) },
      { label: 'Siap Ujian (Surat)', jumlah: parseInt(data.siap_ujian || 0) },
      { label: 'Selesai', jumlah: parseInt(data.selesai || 0) }
    ];
  },

  /* =======================================================
   * 🍰 PIE CHART (WAJIB ADA biar ga error saat fetch)
   * ======================================================= */
  getPieChart: async (tahunId = null) => {
    // Gunakan logic yang sama dengan getStatistikRingkas
    const stats = await Dashboard.getStatistikRingkas(tahunId);
    
    // Mapping array stats ke object untuk Pie Chart
    return {
      upload_berkas: stats[0].jumlah,
      upload_jadwal: stats[1].jumlah,
      tunggu_penguji: stats[2].jumlah,
      surat_terbit: stats[3].jumlah
    };
  },

  /* =======================================================
   * 🔹 Ambil daftar tahun ajaran (Dropdown)
   * ======================================================= */
  getTahunAjarList: async () => {
    const res = await pool.query(`
      SELECT id, nama_tahun || ' ' || semester AS label
      FROM tahun_ajaran ORDER BY id DESC
    `);
    return res.rows;
  },

// 🔹 FUNGSI HYBRID: Ambil Statistik Terfilter + History Lengkap
  getRekapPerDosen: async (tahunId = null) => {
    try {
      const query = `
        SELECT 
          d.id, d.kode_dosen, d.nama,
          
          -- 1. STATISTIK UTAMA (IKUT FILTER TAHUN)
          -- Kalau tahunId null, dia hitung semua. Kalau ada, hitung tahun itu aja.
          COUNT(DISTINCT CASE 
            WHEN m.dosbing1_id = d.id AND ($1::int IS NULL OR m.tahun_ajaran_id = $1) 
            THEN m.id END) AS jumlah_pbb1,
            
          COUNT(DISTINCT CASE 
            WHEN m.dosbing2_id = d.id AND ($1::int IS NULL OR m.tahun_ajaran_id = $1) 
            THEN m.id END) AS jumlah_pbb2,

          -- 2. HISTORY LENGKAP (TETAP DIAMBIL SEMUA TAHUN)
          -- Ini subquery biar list riwayatnya gak ilang walau difilter
          (
              SELECT COALESCE(JSON_AGG(row_to_json(t)), '[]')
              FROM (
                  SELECT
                      th.id AS th_id, -- ID Tahun buat penanda highlight
                      th.nama_tahun || ' ' || th.semester AS label,
                      COUNT(CASE WHEN m2.dosbing1_id = d.id THEN 1 END) as p1,
                      COUNT(CASE WHEN m2.dosbing2_id = d.id THEN 1 END) as p2
                  FROM mahasiswa m2
                  JOIN tahun_ajaran th ON m2.tahun_ajaran_id = th.id
                  WHERE m2.dosbing1_id = d.id OR m2.dosbing2_id = d.id
                  GROUP BY th.id, th.nama_tahun, th.semester
                  ORDER BY th.id DESC
                  LIMIT 3
              ) t
          ) AS history

        FROM dosen d
        LEFT JOIN mahasiswa m ON (m.dosbing1_id = d.id OR m.dosbing2_id = d.id)
        WHERE d.status_aktif = TRUE
        GROUP BY d.id, d.kode_dosen, d.nama
        ORDER BY d.id ASC;
      `;

      // Kirim tahunId sebagai parameter ($1)
      const res = await pool.query(query, [tahunId]);
      return res.rows;

    } catch (err) {
      console.error('❌ ERROR getRekapPerDosen:', err);
      return [];
    }
  },
};

module.exports = { Kaprodi, Dashboard };