const express = require('express');
const router = express.Router();
const kaprodiController = require('../../controllers/kaprodi/pilihPengujiController');

router.get('/', kaprodiController.renderPilihPenguji);

module.exports = router;
