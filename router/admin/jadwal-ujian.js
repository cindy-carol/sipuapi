const express = require('express');
const router = express.Router();
const jadwalController = require('@controllers/admin/jadwalController');

router.get('/', jadwalController.calendarView);

module.exports = router;
