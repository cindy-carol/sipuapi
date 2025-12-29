const express = require('express');
const router = express.Router();
const { ensureAuthenticated, onlyMahasiswa } = require('../../middlewares/auth');

const isiJadwalRoutes = require('./isi-jadwal');
const uploadBerkasRoutes = require('./upload-berkas');
const dashboardRoutes = require('./dashboard');
const panduanRoutes = require('./panduan');

// ========== PROTEKSI SEMUA ROUTE ADMIN ==========
router.use(ensureAuthenticated, onlyMahasiswa);

router.use('/isi-jadwal', isiJadwalRoutes);
router.use('/upload-berkas', uploadBerkasRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/panduan', panduanRoutes);




module.exports = router;
