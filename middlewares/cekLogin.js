function cekAdminLogin(req, res, next) {
  const { nipAdmin, kodeAdmin } = req.body;

  if (!nipAdmin || !kodeAdmin || nipAdmin.trim() === '' || kodeAdmin.trim() === '') {
    return res.status(400).send('NIP dan Kode Admin wajib diisi!');
  }

  next();
}

function cekKaprodiLogin(req, res, next) {
  const { nipKaprodi, kodeKaprodi } = req.body;

  if (!nip || !kodeKaprodi || nipKaprodi.trim() === '' || kodeKaprodi.trim() === '') {
    return res.status(400).send('NIP dan Kode Kaprodi wajib diisi!');
  }

  next();
}

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
