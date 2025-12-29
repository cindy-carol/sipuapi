// router/admin/monitoring.js
const express = require('express');
const router = express.Router();

// Panggil controller monitoring
const monitoringController = require('../../controllers/admin/monitoringController');

// Route utama monitoring
router.get('/', monitoringController.getMonitoringMahasiswa);
router.get('/export', monitoringController.exportMonitoringExcel);


module.exports = router;
