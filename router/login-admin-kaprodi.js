const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { ensureAuthenticated, onlyAdmin, onlyKaprodi } = require('@middlewares/auth');

// Halaman login untuk Admin & Kaprodi
router.get('/', (req, res) => {
  res.render('login-admin-kaprodi', { 
    title: 'Login Admin/Kaprodi',
    currentPage: 'login-admin-kaprodi',
    role: null,
    error: ''
  });
});

// Proses login admin & kaprodi
router.post('/login-admin-kaprodi', authController.loginAdminKaprodi);

// Dashboard Admin
router.get('/admin/dashboard', ensureAuthenticated, onlyAdmin, authController.showDashboardAdmin);

// Dashboard Kaprodi
router.get('/kaprodi/dashboard', ensureAuthenticated, onlyKaprodi, authController.showDashboardKaprodi);

// Logout
router.get('/logout', authController.logout);

module.exports = router;
