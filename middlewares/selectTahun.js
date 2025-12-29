// middleware/globalDataMiddleware.js

const pool = require('../config/db.js'); // Sesuaikan path

const selectTahun = async (req, res, next) => {
  try {
    // 1. Ambil Semua Tahun buat Dropdown
    const result = await pool.query("SELECT * FROM tahun_ajaran ORDER BY id DESC");
    const listTahun = result.rows;

    // 2. LOGIKA AUTO-SELECT (INI KUNCINYA) 🔑
    let selectedId = req.query.tahun_ajaran; // Cek URL dulu (?tahun_ajaran=5)

    if (!selectedId) {
      // Kalau URL kosong, CARI TAHUN YANG STATUSNYA TRUE (AKTIF)
      const tahunAktif = listTahun.find(t => t.status === true);
      
      if (tahunAktif) {
        selectedId = tahunAktif.id; // ✅ Auto-Select yang aktif
      } else {
        selectedId = listTahun[0]?.id; // Fallback ke yang paling atas
      }
    }

    // 3. Simpen biar bisa dipake di View & Controller
    res.locals.tahunAjarList = listTahun;
    res.locals.selectedTahunId = selectedId;
    req.selectedTahunId = selectedId; // Biar controller bisa baca
    
    next();
  } catch (err) {
    console.error('Middleware Error:', err);
    next();
  }
};

module.exports = selectTahun;