const express = require('express');
const router = express.Router();
const akunController = require('../../controllers/admin/kelolaAkunController'); // Sesuaikan path

// Middleware Cek Login Admin (Pastikan kamu punya ini)
// const { verifyAdmin } = require('../middleware/authMiddleware'); 
// router.use(verifyAdmin); 

// GET Halaman
router.get('/', akunController.getHalamanKelolaAkun);

// POST Aksi
router.post('/tambah', akunController.tambahAdmin);
router.post('/reset-password', akunController.resetPassword);
router.post('/toggle-status', akunController.toggleStatus);

module.exports = router;