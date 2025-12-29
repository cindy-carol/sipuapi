const express = require('express');
const router = express.Router();

// Controller terpisah
const daftarMahasiswaController = require('../../controllers/kaprodi/daftarMahasiswaController');
const daftarDosenController = require('../../controllers/kaprodi/daftarDosenController');

// === Mahasiswa (view-only) ===
router.get('/daftar-mahasiswa', daftarMahasiswaController.renderDaftarMahasiswa);

// === Dosen (view-only) ===
router.get('/daftar-dosen', daftarDosenController.renderDaftarDosen);

module.exports = router;
