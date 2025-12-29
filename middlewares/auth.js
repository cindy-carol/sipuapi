// middleware/auth.js

/**
 * ============================================================
 * 🛡️ MIDDLEWARE: ENSURE AUTHENTICATED
 * ============================================================
 * Mengecek apakah user memiliki sesi aktif di server.
 * Digunakan di hampir semua route yang butuh login.
 */
function ensureAuthenticated(req, res, next) {
  // Jika session user ada, silakan lewat
  if (req.session?.user) return next();

  // --- LOGIC PENANGANAN REQUEST ---
  
  // 1. Jika request datang dari AJAX/Fetch (JSON)
  // Penting agar frontend (SweetAlert/Modal) tidak error saat session expired
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({ 
      success: false, 
      message: 'Sesi Anda telah berakhir, silakan login kembali.' 
    });
  }

  // 2. Jika request halaman biasa, lempar ke halaman login utama
  res.redirect('/');
}

/**
 * ============================================================
 * 🔑 HELPER: CHECK ROLE
 * ============================================================
 * Fungsi internal untuk memvalidasi role user di dalam session.
 */
function checkRole(role) {
  return (req, res, next) => {
    // Pastikan session ada dan role cocok (Case Insensitive)
    if (req.session?.user?.role?.toLowerCase() === role.toLowerCase()) {
      return next();
    }
    
    // Jika role tidak cocok, kirim Forbidden (403)
    res.status(403).render('error', { 
      message: `Akses Ditolak: Halaman ini khusus untuk ${role}.`,
      role: req.session?.user?.role || 'guest'
    });
  };
}

// ============================================================
// 🚦 EXPORT MIDDLEWARE SPESIFIK ROLE
// ============================================================
const onlyAdmin = checkRole('Admin');
const onlyKaprodi = checkRole('Kaprodi');
const onlyMahasiswa = checkRole('Mahasiswa');

module.exports = {
  ensureAuthenticated,
  onlyAdmin,
  onlyKaprodi,
  onlyMahasiswa
};