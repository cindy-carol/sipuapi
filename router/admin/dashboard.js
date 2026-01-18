const express = require('express');
const router = express.Router();

// Controller
const dashboardController = require('../../controllers/admin/dashboardController');

// Render dashboard
router.get('/', dashboardController.renderDashboard);

// Chart Data
router.get('/chart/tahun', dashboardController.getStatTahun);
router.get('/chart/bar', dashboardController.getBarChart);
router.get('/chart/pie', dashboardController.getPieChart);

// CRUD Kartu Informasi
router.post('/rincian', dashboardController.addRincian);

// 2. Update Rincian (Ubah ke PUT dengan ID di URL)
router.put('/rincian/:id', dashboardController.updateRincian);
module.exports = router;