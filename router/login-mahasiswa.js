const express = require('express');
const router = express.Router();
const authMahasiswaController = require('@controllers/authMahasiswaController');
const { ensureAuthenticated, onlyMahasiswa } = require('@middlewares/auth');

// Halaman login mahasiswa
router.get('/login', (req, res) => {
  res.render('login-mahasiswa', { 
    title: 'Login Mahasiswa',
    currentPage: 'login-mahasiswa',
    role: null,
    error: ''
  });
});

// Proses login mahasiswa (tanpa password, cukup NPM)
router.post('/login', authMahasiswaController.loginMahasiswa);

// Dashboard mahasiswa
router.get('/dashboard', ensureAuthenticated, onlyMahasiswa, authMahasiswaController.showDashboardMahasiswa);

// Logout mahasiswa
router.get('/logout', authMahasiswaController.logout);

module.exports = router;
