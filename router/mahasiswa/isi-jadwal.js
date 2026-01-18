const express = require('express');
const router = express.Router();

const isiJadwalController = require('../../controllers/mahasiswa/isiJadwalController'); 

// ==================================================
// DEFINISI ROUTE
// ==================================================

// 1. Tampilkan Halaman (GET /mahasiswa/isi-jadwal)
router.get('/', isiJadwalController.getIsiJadwal);

// 2. Proses Simpan Jadwal (POST /mahasiswa/isi-jadwal)
router.post('/', isiJadwalController.postIsiJadwal);

// 3. Proses Hapus Jadwal (POST /mahasiswa/isi-jadwal/hapus-jadwal)
router.delete('/', isiJadwalController.hapusJadwal);

module.exports = router;