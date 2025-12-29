// controllers/authMahasiswaController.js
const pool = require('../config/db');
const { Mahasiswa } = require('../models/mahasiswaModel');
const { getUserByUsername } = require('../models/akunModel');

const authMahasiswaController = {
  // ==========================
  // 🧩 LOGIN MAHASISWA
  // ==========================
  loginMahasiswa: async (req, res) => {
    const { npm } = req.body;

    try {
      // 1. Validasi input NPM 
      if (!npm?.trim()) {
        return res.render('login-mahasiswa', { 
          title: 'Login Mahasiswa',
          currentPage: 'login-mahasiswa',
          error: 'NPM wajib diisi' 
        });
      }

      // 2. Cek akun dari tabel akun (Status Aktif & Role) 
      const akun = await getUserByUsername(npm.trim());
      if (!akun || akun.role.toLowerCase() !== 'mahasiswa' || !akun.status_aktif) {
        return res.render('login-mahasiswa', { 
          title: 'Login Mahasiswa',
          currentPage: 'login-mahasiswa',
          error: 'NPM tidak ditemukan, akun dinonaktifkan, atau belum terdaftar.' 
        });
      }

      // 3. Ambil data profil mahasiswa berdasarkan NPM 
      const mahasiswa = await Mahasiswa.getMahasiswaByNPM(npm.trim());
      if (!mahasiswa) {
        return res.render('login-mahasiswa', { 
          title: 'Login Mahasiswa',
          currentPage: 'login-mahasiswa',
          error: 'Data mahasiswa tidak ditemukan di pangkalan data.' 
        });
      }

      // 4. Simpan data ke session untuk akses serverless 
      req.session.user = {
        id: akun.id,
        mahasiswa_id: mahasiswa.id,
        npm: mahasiswa.npm,
        nama: mahasiswa.nama,
        role: akun.role
      };

      console.log(`✅ Login mahasiswa berhasil: ${mahasiswa.nama} (${mahasiswa.npm})`);
      res.redirect('/mahasiswa/dashboard');

    } catch (err) {
      console.error('❌ ERROR loginMahasiswa:', err);
      res.render('login-mahasiswa', { 
        title: 'Login Mahasiswa',
        currentPage: 'login-mahasiswa',
        error: 'Terjadi kesalahan sistem pada server.' 
      });
    }
  },

  // ==========================
  // 📊 DASHBOARD
  // ==========================
  showDashboardMahasiswa: async (req, res) => {
    try {
      // Pastikan session user tersedia sebelum query 
      if (!req.session.user || !req.session.user.npm) {
        return res.redirect('/login');
      }

      const { npm } = req.session.user;
      const mhs = await Mahasiswa.getMahasiswaByNPM(npm);

      if (!mhs) {
        return res.render('error', { message: 'Data mahasiswa tidak ditemukan atau telah dihapus.' });
      }

      // Render dashboard dengan data terbaru dari DB 
      res.render('mahasiswa/dashboard', {
        title: 'Dashboard Mahasiswa',
        currentPage: 'dashboard',
        role: 'Mahasiswa',
        nama: mhs.nama,
        npm: mhs.npm,
        thajaran: `${mhs.nama_tahun} ${mhs.semester}`,
        dosbing1: mhs.dosbing1 || 'Belum Ditentukan',
        dosbing2: mhs.dosbing2 || 'Belum Ditentukan'
      });

    } catch (err) {
      console.error('❌ ERROR showDashboardMahasiswa:', err);
      res.render('error', { message: 'Terjadi kesalahan saat memuat data dashboard.' });
    }
  },

  // ==========================
  // 🚪 LOGOUT
  // ==========================
  logout: (req, res) => {
    // Hancurkan session dan hapus cookie untuk keamanan 
    req.session.destroy((err) => {
      if (err) {
        console.error('❌ Logout Error:', err);
      }
      res.clearCookie('connect.sid');
      res.redirect('/login'); // Kembali ke halaman utama login mahasiswa
    });
  },
};

module.exports = authMahasiswaController;