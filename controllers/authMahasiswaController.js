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
      if (!npm?.trim()) {
        return res.render('login-mahasiswa', { 
          title: 'Login Mahasiswa',
          currentPage: 'login-mahasiswa',
          error: 'NPM wajib diisi' 
        });
      }

      // 🔹 Cek akun dari tabel akun
      const akun = await getUserByUsername(npm.trim());
      if (!akun || akun.role.toLowerCase() !== 'mahasiswa' || !akun.status_aktif) {
        return res.render('login-mahasiswa', { 
          title: 'Login Mahasiswa',
          currentPage: 'login-mahasiswa',
          error: 'NPM tidak ditemukan atau belum terdaftar.' 
        });
      }

      // 🔹 Ambil data mahasiswa berdasarkan NPM
      const mahasiswa = await Mahasiswa.getMahasiswaByNPM(npm.trim());
      if (!mahasiswa) {
        return res.render('login-mahasiswa', { 
          title: 'Login Mahasiswa',
          currentPage: 'login-mahasiswa',
          error: 'Data mahasiswa tidak ditemukan.' 
        });
      }

      // 🔹 Simpan data ke session
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
        error: 'Terjadi kesalahan pada server.' 
      });
    }
  },

  // ==========================
  // 📊 DASHBOARD
  // ==========================
  showDashboardMahasiswa: async (req, res) => {
    try {
      const { npm } = req.session.user;
      const mhs = await Mahasiswa.getMahasiswaByNPM(npm);

      if (!mhs) {
        return res.render('error', { message: 'Data mahasiswa tidak ditemukan' });
      }

      res.render('mahasiswa/dashboard', {
        title: 'Dashboard Mahasiswa',
        currentPage: 'dashboard',
        role: 'Mahasiswa',
        nama: mhs.nama,
        npm: mhs.npm,
        thajaran: `${mhs.nama_tahun} ${mhs.semester}`,
        dosbing1: mhs.dosbing1,
        dosbing2: mhs.dosbing2
      });
    } catch (err) {
      console.error('❌ ERROR showDashboardMahasiswa:', err);
      res.render('error', { message: 'Terjadi kesalahan saat memuat dashboard' });
    }
  },

  // ==========================
  // 🚪 LOGOUT
  // ==========================
logout: (req, res) => {
    req.session.destroy((err) => {
      if (err) console.log(err);
      res.clearCookie('connect.sid');
      res.redirect('/login'); // Arahkan kembali ke Login Mahasiswa
    });
  },
};

module.exports = authMahasiswaController;
