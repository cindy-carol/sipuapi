// router/admin/verifikasi.js
const express = require('express');
const router = express.Router();

// Import controller
const cekBerkasController = require('../../controllers/admin/cekBerkasController');
const verifikasiController = require('../../controllers/admin/verifikasiController');
const model = require('../../models/cekBerkasModel'); 

const { uploadAdmin } = require('../../middlewares/upload');

// =========================================================
// 🛠️ SETTINGS TEMPLATE (PASTIKAN FUNGSI INI ADA DI CONTROLLER)
// =========================================================
// Jika error berlanjut di baris ini, cek apakah 'getTemplateSettings' 
// sudah di-export di verifikasiController.js
if (verifikasiController.getTemplateSettings) {
    router.get('/api/template-surat', verifikasiController.getTemplateSettings);
}
if (verifikasiController.saveTemplateSettings) {
    router.post('/api/template-surat', verifikasiController.saveTemplateSettings);
}

// =========================================================
// 📂 1. CEK BERKAS SYARAT
// =========================================================
router.get('/cek-berkas/:npm', cekBerkasController.list);
router.post('/update-status-reject', cekBerkasController.rejectBerkas);

// Update status via AJAX/Fetch
router.post('/update-status/:id', async (req, res) => {
  const { id } = req.params;
  const { status, catatan } = req.body; 

  try {
    const statusBool = status === 'true'; 
    const adminId = req.session.user?.id || null;

    // Panggil model dengan 4 parameter
    await model.updateStatus(id, statusBool, catatan, adminId);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error update-status:', err);
    res.status(500).json({ success: false, message: 'Gagal update status' });
  }
});

// =========================================================
// ⚖️ 2. WORKFLOW VERIFIKASI & SURAT
// =========================================================
router.post('/oper-kaprodi', verifikasiController.operKeKaprodi);
router.get('/surat-undangan/:npm/generate', verifikasiController.generateUndanganPDF);
router.get('/surat-detail/:npm', verifikasiController.getSuratDetail); 
router.put('/update-surat-detail/:jadwalId', verifikasiController.updateSuratDetail);
router.get('/api/dosen', verifikasiController.getDosenList);

// Upload & Delete Surat TTD
router.post('/upload-surat/:npm', uploadAdmin.single('surat_undangan'), verifikasiController.uploadSuratTTD);
router.delete('/delete-surat', verifikasiController.deleteSuratTTD);

// =========================================================
// 🏁 3. PENYELESAIAN & DASHBOARD
// =========================================================
router.post('/tandai-selesai', verifikasiController.tandaiSelesai);
router.get('/', verifikasiController.listAll);

module.exports = router;