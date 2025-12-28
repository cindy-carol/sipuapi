// middleware/auth.js

// Pastikan user sudah login
function ensureAuthenticated(req, res, next) {
  if (req.session?.user) return next();

  // Kalau request dari AJAX (fetch)
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({ error: 'Unauthorized, please login first' });
  }

  // Kalau request biasa, redirect ke login
  res.redirect('/');
}


// Helper untuk cek role tertentu
function checkRole(role) {
  return (req, res, next) => {
    if (req.session?.user?.role?.toLowerCase() === role.toLowerCase()) {
      return next();
    }
    res.status(403).send(`Akses ditolak: hanya ${role} yang boleh masuk.`);
  };
}

// Middleware spesifik role
const onlyAdmin = checkRole('Admin');
const onlyKaprodi = checkRole('Kaprodi');
const onlyMahasiswa = checkRole('Mahasiswa');

module.exports = {
  ensureAuthenticated,
  onlyAdmin,
  onlyKaprodi,
  onlyMahasiswa
};
