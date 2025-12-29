require('dotenv').config();
require('module-alias/register');

const express = require('express');
const path = require('path');
const app = express();
const pool = require('./config/db');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts'); // ✅ Layouts
const PORT = 3000;
const startScheduler = require('./utils/scheduler');
const selectTahun = require('./middlewares/selectTahun');

// ===== Set view engine =====
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ===== Middleware express-ejs-layouts =====
app.use(expressLayouts);
app.set('layout', 'layout'); // ✅ Layout default untuk semua halamanz

// ===== Middleware umum =====
app.use(express.static(path.join(__dirname, 'public')));
app.use('/upload', express.static(path.join(__dirname, 'public/upload')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Untuk parsing JSON (misal dari fetch/AJAX)

// ===== Session =====
app.use(session({
  secret: process.env.SESSION_SECRET || 'kombinasi_acak_rahasia',
  resave: false,
  saveUninitialized: false,
  proxy: true, // Tambahkan ini agar Vercel bisa baca header proxy
  cookie: {
    secure: process.env.NODE_ENV === "production", // Otomatis true kalau di Vercel
    sameSite: process.env.NODE_ENV === "production" ? 'none' : 'lax', // Biar aman di cross-site
    maxAge: 60 * 60 * 1000 
  }
}));

// ===== Variabel global untuk EJS =====
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.role = req.session.user ? req.session.user.role : null;

  // ✅ Tambahkan default sidebar tampil
  res.locals.hideSidebar = false;

  next();
});

app.use(selectTahun);

// ===== Routing =====
const loginRoutes = require('./router/login-admin-kaprodi');
app.use('/', loginRoutes);

const loginMahasiswaRoutes = require('./router/login-mahasiswa');
app.use('/', loginMahasiswaRoutes);

const profileRouter = require('./router/profile'); // Import router yg baru dibuat
app.use('/profile', profileRouter);

const adminRoutes = require('./router/admin/admin');
app.use('/admin', adminRoutes);

const kaprodiRoutes = require('./router/kaprodi/kaprodi');
app.use('/kaprodi', kaprodiRoutes);

const mahasiswaRoutes = require('./router/mahasiswa/mahasiswa');
app.use('/mahasiswa', mahasiswaRoutes);

// ===== Cek koneksi database =====
app.get('/cek-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT 1+1 AS hasil');
    res.send(`✅ Koneksi OK! Hasil: ${result.rows[0].hasil}`);
  } catch (err) {
    console.error('❌ Gagal konek:', err.message);
    res.status(500).send('Gagal konek ke database!');
  }
});

startScheduler();

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server jalan di http://localhost:${PORT}`);
  });
}

module.exports = app;
