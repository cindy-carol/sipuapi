// router/admin/monitoring.js
const express = require('express');
const router = express.Router();

// Panggil controller monitoring
const monitoringController = require('../../controllers/kaprodi/monitoringController');

// Route utama monitoring
router.get('/', monitoringController.getMonitoringMahasiswa);

module.exports = router;
