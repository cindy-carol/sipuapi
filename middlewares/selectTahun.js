// middleware/globalDataMiddleware.js

const pool = require('../config/db.js'); // Sesuaikan path config database Anda

/**
 * ============================================================
 * 🌍 MIDDLEWARE: SELECT TAHUN AJARAN GLOBAL
 * ============================================================
 * Bertugas menyediakan daftar tahun ajaran untuk dropdown 
 * dan menentukan tahun mana yang sedang aktif dipilih.
 */
const selectTahun = async (req, res, next) => {
  try {
    // 1. Ambil Semua Tahun dari Database untuk kebutuhan Dropdown di Sidebar/Header
    // Diurutkan dari ID terbesar (terbaru)
    const result = await pool.query("SELECT * FROM tahun_ajaran ORDER BY id DESC");
    const listTahun = result.rows;

    // 2. LOGIKA AUTO-SELECT (Kunci sinkronisasi filter) 🔑
    let selectedId = req.query.tahun_ajaran; // Prioritas 1: Cek URL (?tahun_ajaran=5)

    if (!selectedId) {
      // Prioritas 2: Kalau URL kosong, CARI TAHUN YANG STATUSNYA TRUE (AKTIF) di database
      const tahunAktif = listTahun.find(t => t.status === true);
      
      if (tahunAktif) {
        selectedId = tahunAktif.id; // ✅ Set otomatis ke tahun yang sedang berjalan
      } else {
        // Prioritas 3: Fallback terakhir jika tidak ada yang aktif, ambil baris paling atas
        selectedId = listTahun[0]?.id; 
      }
    }

    // 3. MENYIMPAN DATA KE LOCALS & REQUEST
    
    // Simpan di res.locals agar otomatis bisa dibaca oleh file EJS manapun tanpa dikirim manual
    res.locals.tahunAjarList = listTahun;
    res.locals.selectedTahunId = selectedId;
    
    // Simpan di req agar Controller bisa melakukan filter query database berdasarkan ID ini
    req.selectedTahunId = selectedId; 
    
    next();
  } catch (err) {
    // Jika terjadi error (misal tabel belum dibuat), aplikasi tetap lanjut agar tidak crash
    console.error('❌ GlobalDataMiddleware Error:', err);
    res.locals.tahunAjarList = [];
    res.locals.selectedTahunId = null;
    next();
  }
};

module.exports = selectTahun;