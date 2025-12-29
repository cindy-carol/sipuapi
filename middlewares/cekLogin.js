// middleware/loginValidation.js

/**
 * ============================================================
 * 🛡️ MIDDLEWARE VALIDASI INPUT LOGIN
 * ============================================================
 * Bertugas mencegat request di pintu depan sebelum diproses 
 * oleh Controller/Database. Menghemat resource server.
 */

// 1. Validasi Login Admin
function cekAdminLogin(req, res, next) {
  const { nipAdmin, kodeAdmin } = req.body;

  // Cek apakah field ada dan bukan sekadar spasi kosong
  if (!nipAdmin || !kodeAdmin || nipAdmin.trim() === '' || kodeAdmin.trim() === '') {
    return res.status(400).send('NIP dan Kode Admin wajib diisi!');
  }

  next();
}

// 2. Validasi Login Kaprodi
function cekKaprodiLogin(req, res, next) {
  const { nipKaprodi, kodeKaprodi } = req.body;

  // 🔥 FIX: Tadi ada typo 'nip' saja, sudah diperbaiki jadi 'nipKaprodi'
  if (!nipKaprodi || !kodeKaprodi || nipKaprodi.trim() === '' || kodeKaprodi.trim() === '') {
    return res.status(400).send('NIP dan Kode Kaprodi wajib diisi!');
  }

  next();
}

// 3. Validasi Login Mahasiswa
function cekMahasiswaLogin(req, res, next) {
  const { npm } = req.body;

  if (!npm || npm.trim() === '') {
    return res.status(400).send('NPM wajib diisi!');
  }

  next();
}

module.exports = {
  cekAdminLogin,
  cekKaprodiLogin,
  cekMahasiswaLogin
};