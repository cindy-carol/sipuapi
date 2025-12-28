const express = require('express');
const router = express.Router();
const { ensureAuthenticated, onlyKaprodi } = require('@middlewares/auth');

const daftarRoutes = require('./daftar');
const penetapanPengujiRoutes = require('./penetapan-penguji');
const dashboardRoutes = require('./dashboard');
const monitoringRoutes = require('./monitoring');


// ========== PROTEKSI SEMUA ROUTE ADMIN ==========
router.use(ensureAuthenticated, onlyKaprodi);

router.use('/daftar', daftarRoutes);
router.use('/penetapan-penguji', penetapanPengujiRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/monitoring', monitoringRoutes);


module.exports = router;
