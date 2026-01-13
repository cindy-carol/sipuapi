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

      const cleanNPM = npm.trim();

      // 2. Cek akun dari tabel akun (Status Aktif & Role) 
      const akun = await getUserByUsername(cleanNPM);
      if (!akun || akun.role.toLowerCase() !== 'mahasiswa' || !akun.status_aktif) {
        return res.render('login-mahasiswa', { 
          title: 'Login Mahasiswa',
          currentPage: 'login-mahasiswa',
          error: 'NPM tidak ditemukan, akun dinonaktifkan, atau belum terdaftar.' 
        });
      }

      // 3. FIX: Gunakan findByNPM (sesuai mahasiswaModel.js)
      const mahasiswa = await Mahasiswa.findByNPM(cleanNPM);
      if (!mahasiswa) {
        return res.render('login-mahasiswa', { 
          title: 'Login Mahasiswa',
          currentPage: 'login-mahasiswa',
          error: 'Data profil mahasiswa tidak ditemukan.' 
        });
      }

      // 4. Simpan data ke session
      req.session.user = {
        id: akun.id,
        mahasiswa_id: mahasiswa.id,
        npm: mahasiswa.npm,
        nama: mahasiswa.nama,
        role: akun.role
      };

      console.log(`✅ Login mahasiswa berhasil: ${mahasiswa.nama} (${mahasiswa.npm})`);
      
      // Pastikan redirect ke path yang benar
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
      if (!req.session.user || !req.session.user.npm) {
        return res.redirect('/');
      }

      const { npm } = req.session.user;
      
      // FIX: Gunakan findByNPM (sesuai mahasiswaModel.js)
      const mhs = await Mahasiswa.findByNPM(npm);

      if (!mhs) {
        return res.render('error', { message: 'Data mahasiswa tidak ditemukan.' });
      }

      res.render('mahasiswa/dashboard', {
        title: 'Dashboard Mahasiswa',
        currentPage: 'dashboard',
        role: 'mahasiswa',
        nama: mhs.nama,
        npm: mhs.npm,
        thajaran: `${mhs.nama_tahun} ${mhs.semester}`,
        dosbing1: mhs.dosbing1 || 'Belum Ditentukan',
        dosbing2: mhs.dosbing2 || 'Belum Ditentukan'
      });

    } catch (err) {
      console.error('❌ ERROR showDashboardMahasiswa:', err);
      res.status(500).render('error', { message: 'Gagal memuat dashboard.' });
    }
  },

  // ==========================
  // 🚪 LOGOUT
  // ==========================
  logout: (req, res) => {
    req.session.destroy((err) => {
      if (err) console.error('❌ Logout Error:', err);
      res.clearCookie('connect.sid', { path: '/' }); // Bersihkan cookie secara global
      res.redirect('/login'); 
    });
  },
};

module.exports = authMahasiswaController;