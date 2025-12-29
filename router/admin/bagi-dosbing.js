const express = require('express');
const router = express.Router();
const { uploadAdmin } = require('../../middlewares/upload');

// Controller
const bagiDosbingController = require('../../controllers/admin/bagiDosbingController');

// Halaman pembagian dosbing
router.get('/', bagiDosbingController.renderbagiDosbing); 

// Upload Excel
router.post(
  '/upload',
  uploadAdmin.fields([{ name: 'daftar_dosbing', maxCount: 1 }]),
  bagiDosbingController.uploadDosbing
);

router.put('/update-dosbing/:npm', bagiDosbingController.editDosbing);

module.exports = router;
