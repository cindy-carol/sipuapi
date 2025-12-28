const express = require('express');
const router = express.Router();
const { ensureAuthenticated, onlyMahasiswa } = require('@middlewares/auth');
const dashboardController = require('@controllers/mahasiswa/dashboardController');

// Route dashboard mahasiswa
router.get('/', ensureAuthenticated, onlyMahasiswa, dashboardController.showDashboard);
router.get('/surat', ensureAuthenticated, onlyMahasiswa, dashboardController.showDashboard);

module.exports = router;
