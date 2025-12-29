const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController'); // Sesuaikan path alias

// Ini pintu masuknya: POST /profile/update
router.post('/update', profileController.updateProfile);

module.exports = router;