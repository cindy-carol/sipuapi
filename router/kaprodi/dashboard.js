const express = require('express');
const router = express.Router();
const dashboardController = require('@controllers/kaprodi/dashboardController');
const penetapanPengujiController = require('@controllers/kaprodi/penetapanPengujiController');


// route GET /
router.get('/', dashboardController.renderDashboard);
router.get('/', penetapanPengujiController.getPenetapanPenguji);


router.get('/chart/tahun', dashboardController.getStatTahun);
router.get('/chart/bar', dashboardController.getBarChart);
router.get('/chart/pie', dashboardController.getPieChart);

module.exports = router;
