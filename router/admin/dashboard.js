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
router.post('/add-rincian', dashboardController.addRincian);
router.post('/update-rincian', dashboardController.updateRincian);
router.get('/delete-rincian/:id', dashboardController.deleteRincian);

module.exports = router;