const express = require('express');
const router = express.Router();
const { uploadAdmin } = require('@middlewares/upload');
const daftarMahasiswaController = require('@controllers/admin/daftarMahasiswaController');
const daftarDosenController = require('@controllers/admin/daftarDosenController');

// Mahasiswa
router.get('/daftar-mahasiswa', daftarMahasiswaController.renderDaftarMahasiswa);
router.post(
   '/daftar-mahasiswa/upload',
 uploadAdmin.fields([{ name: 'daftar_mahasiswa', maxCount: 1 }]),
 daftarMahasiswaController.uploadDaftarMahasiswa
);

router.post('/mahasiswa', daftarMahasiswaController.createMahasiswa);
router.put('/mahasiswa/:npm', daftarMahasiswaController.updateMahasiswa);
router.delete('/mahasiswa/:npm', daftarMahasiswaController.deleteMahasiswa);

// Dosen
router.get('/daftar-dosen', daftarDosenController.renderDaftarDosen);
router.post(
  '/daftar-dosen/upload',
  uploadAdmin.fields([{ name: 'daftar_dosen', maxCount: 1 }]),
  daftarDosenController.uploadDaftarDosen
);

router.post('/dosen', daftarDosenController.createDosen); // Menggunakan endpoint generik tanpa ID
router.put('/dosen/:kodeDosen', daftarDosenController.updateDosen);
router.delete('/dosen/:kodeDosen', daftarDosenController.deleteDosen);

module.exports = router;
