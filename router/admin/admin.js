const express = require('express');
const router = express.Router();
const { ensureAuthenticated, onlyAdmin } = require('@middlewares/auth');

// ===== Proteksi semua route admin =====
router.use(ensureAuthenticated, onlyAdmin);

// ===== Dashboard =====
const dashboardRoutes = require('./dashboard');
router.use('/dashboard', dashboardRoutes);

// ===== Mahasiswa & Dosen =====
const daftarRoutes = require('./daftar');
router.use('/', daftarRoutes);

// ===== Monitoring / Statistik =====
const monitoringRoutes = require('./monitoring');
router.use('/monitoring', monitoringRoutes);

// ===== Verifikasi / Cek Berkas / Berita Acara =====
const verifikasiRoutes = require('./verifikasi'); // gabungan cek-berkas + cek-berita-acara + daftar-tunggu-validasi + daftar-verifikasi-berita-acara
router.use('/verifikasi', verifikasiRoutes);

const suratRoutes = require('./surat-undangan'); // gabungan cek-berkas + cek-berita-acara + daftar-tunggu-validasi + daftar-verifikasi-berita-acara
router.use('/surat-undangan', suratRoutes);

// ===== Pembagian Dosbing =====
const bagiDosbingRoutes = require('./bagi-dosbing');
router.use('/bagi-dosbing', bagiDosbingRoutes);

// ===== Jadwal Ujian =====
const jadwalRoutes = require('./jadwal-ujian');
router.use('/jadwal-ujian', jadwalRoutes);

const kelolaAkunRoutes = require('./kelola-akun');
router.use('/kelola-akun', kelolaAkunRoutes);

module.exports = router;
