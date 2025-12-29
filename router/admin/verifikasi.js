// router/admin/verifikasi.js
const express = require('express');
const router = express.Router();

// Import controller
const cekBerkasController = require('../../controllers/admin/cekBerkasController');
const verifikasiController = require('../../controllers/admin/verifikasiController');
const model = require('../../models/cekBerkasModel.js'); 

const { uploadAdmin } = require('../../middlewares/upload');

// Route untuk Edit Template Global
router.get('/api/template-surat', verifikasiController.getTemplateSettings);
router.post('/api/template-surat', verifikasiController.saveTemplateSettings);
// ...

// =========================
// 1. Cek Berkas Syarat
// =========================
router.get('/cek-berkas/:npm', cekBerkasController.list);

// (Opsional) Kalau masih pake tombol kembalikan global
router.post('/cek-berkas/:npm/kembalikan', cekBerkasController.returnToMahasiswa);


// =========================================================
// ✅ ROUTE BARU: KHUSUS UNTUK MODAL REJECT (FORM SUBMIT)
// =========================================================
// Ini yang dipanggil sama form di dalam modal tabel tadi
// Nanti lari ke controller 'rejectBerkas' terus redirect back
router.post('/update-status-reject', cekBerkasController.rejectBerkas);


// =========================================================
// ✅ UPDATE ROUTE LAMA: UPDATE STATUS VIA AJAX/FETCH
// =========================================================
router.post('/update-status/:id', async (req, res) => {
  const { id } = req.params;
  const { status, catatan } = req.body; 

  try {
    const statusBool = status === 'true'; 
    
    // 🔥 AMBIL ID ADMIN DARI SESSION
    const adminId = req.session.user?.id || null;

    // Panggil model dengan 4 parameter (ID, Status, Catatan, AdminID)
    await model.updateStatus(id, statusBool, catatan, adminId);

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error update-status:', err);
    res.status(500).json({ success: false, message: 'Gagal update status' });
  }
});


// =========================
// Route Lainnya (Tetap)
// =========================
router.post('/oper-kaprodi', verifikasiController.operKeKaprodi);

router.get('/surat-undangan/:npm/generate', verifikasiController.generateUndanganPDF);

// 2. 🔥 INI YANG KURANG: Route untuk ambil data JSON buat Modal
router.get('/surat-detail/:npm', verifikasiController.getSuratDetail); 

// 3. Route untuk Simpan Perubahan (Sudah ada)
router.put('/update-surat-detail/:jadwalId', verifikasiController.updateSuratDetail);

router.get('/api/dosen', verifikasiController.getDosenList);

router.post('/upload-surat/:npm', uploadAdmin.single('surat_undangan'), verifikasiController.uploadSuratTTD);
router.delete('/delete-surat', verifikasiController.deleteSuratTTD);
// ...


router.post('/tandai-selesai', verifikasiController.tandaiSelesai);

// =========================
// 2. Verifikasi Mahasiswa
// =========================
router.get('/', verifikasiController.listAll);

module.exports = router;