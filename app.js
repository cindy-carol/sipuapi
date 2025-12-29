require('dotenv').config();
require('module-alias/register');

const express = require('express');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const expressLayouts = require('express-ejs-layouts');

const app = express();
const pool = require('./config/db');
const PORT = process.env.PORT || 3000;
const startScheduler = require('./utils/scheduler');
const selectTahun = require('./middlewares/selectTahun');

// ===== Set view engine =====
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ===== Middleware express-ejs-layouts =====
app.use(expressLayouts);
app.set('layout', 'layout'); 

// ===== Middleware umum =====
app.use(express.static(path.join(__dirname, 'public')));
app.use('/upload', express.static(path.join(__dirname, 'public/upload')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ===== Session (Persistent with PostgreSQL) =====
app.use(session({
  store: new pgSession({
    pool: pool,                
    tableName: 'session'       
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  proxy: true, // Dibutuhkan Vercel untuk HTTPS
  cookie: { 
    maxAge: 60 * 60 * 1000, // 1 Jam
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

// ===== Variabel global untuk EJS =====
// Di app.js cari bagian res.locals
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.role = req.session.user ? req.session.user.role : null;
  res.locals.title = 'SIPUAPI'; // Tambahin nilai default ini
  res.locals.currentPage = '';  // Tambahin nilai default ini
  res.locals.hideSidebar = false;
  next();
});

app.use(selectTahun);

// ===== Routing =====
const loginRoutes = require('./router/login-admin-kaprodi');
const loginMahasiswaRoutes = require('./router/login-mahasiswa');
const profileRouter = require('./router/profile');
const adminRoutes = require('./router/admin/admin');
const kaprodiRoutes = require('./router/kaprodi/kaprodi');
const mahasiswaRoutes = require('./router/mahasiswa/mahasiswa');

app.use('/', loginRoutes);
app.use('/', loginMahasiswaRoutes);
app.use('/profile', profileRouter);
app.use('/admin', adminRoutes);
app.use('/kaprodi', kaprodiRoutes);
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

// ===== Start server (Support Vercel) =====
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server jalan di http://localhost:${PORT}`);
  });
}

module.exports = app;