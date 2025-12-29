// routes/kaprodi/penetapanPenguji.js
const express = require('express');
const router = express.Router();
const penetapanPengujiController = require('../../controllers/kaprodi/penetapanPengujiController');
const pilihPengujiController = require('../../controllers/kaprodi/pilihPengujiController');

// Daftar penetapan penguji
router.get('/', penetapanPengujiController.getPenetapanPenguji);

// Halaman pilih penguji untuk mahasiswa tertentu (pakai query param atau param)
router.get('/pilih-penguji/:npm', pilihPengujiController.renderPilihPenguji);
router.post('/pilih-penguji/:npm', pilihPengujiController.postPilihPenguji);

module.exports = router;
