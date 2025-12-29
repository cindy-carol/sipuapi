const express = require('express');
const router = express.Router();
const { uploadMahasiswa } = require('../../middlewares/upload');
const uploadBerkasController = require('../../controllers/mahasiswa/uploadBerkasController');
const { ensureAuthenticated, onlyMahasiswa } = require('../../middlewares/auth'); // ambil middleware auth

// Halaman upload berkas
router.get(
  '/',
  ensureAuthenticated,
  onlyMahasiswa,
  uploadBerkasController.showUploadPage
);

// POST: upload 3 file sekaligus
router.post(
  '/upload',
  ensureAuthenticated,
  onlyMahasiswa,
  uploadMahasiswa.fields([
    { name: 'dokumen_rpl', maxCount: 1 },
    { name: 'draft_artikel', maxCount: 1 },
    { name: 'kartu_asistensi_1', maxCount: 1 },
    { name: 'kartu_asistensi_2', maxCount: 1 },
    { name: 'kartu_asistensi_3', maxCount: 1 },
  ]),
  uploadBerkasController.uploadFiles
);

router.delete(
  '/delete',
  ensureAuthenticated,
  onlyMahasiswa,
  uploadBerkasController.deleteFile
);

module.exports = router;
