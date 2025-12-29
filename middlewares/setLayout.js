// middleware/setLayout.js

/**
 * ============================================================
 * 🖥️ MIDDLEWARE: SET LAYOUT (UI CONTROLLER)
 * ============================================================
 * Mengatur variabel global untuk tampilan, seperti visibilitas 
 * sidebar dan informasi role pengguna yang sedang login.
 */
function setLayout(req, res, next) {
  // 1. Default: Sidebar ditampilkan di semua halaman
  res.locals.hideSidebar = false;

  // 2. Daftar halaman yang TIDAK membutuhkan sidebar (Full Width)
  // Contoh: Halaman Login, Error 404, atau landing page utama.
  const noSidebarPages = [
    '/',
    '/login',
    '/login-admin-kaprodi',
    '/register'
    // Silakan tambah route lain sesuai kebutuhan desain Anda
  ];

  // 3. Cek apakah path saat ini ada di dalam daftar pengecualian
  if (noSidebarPages.includes(req.path)) {
    res.locals.hideSidebar = true;
  }

  // 4. Sinkronisasi Role Pengguna
  // Mengambil role dari session agar bisa diakses langsung di EJS untuk logic menu
  res.locals.role = req.session.user?.role || null;
  res.locals.userName = req.session.user?.nama || 'Guest';

  next();
}

module.exports = setLayout;