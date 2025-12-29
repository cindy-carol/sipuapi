// controllers/kaprodi/daftarDosenController
const { Dosen } = require('../../models/dosenModel');

// ===============================
// RENDER: Halaman Daftar Dosen
// ===============================
const renderDaftarDosen = async (req, res) => {
  try {
    const dosen = await Dosen.getAll();
    res.render('kaprodi/daftar-dosen', {
      title: 'Daftar Dosen',
      currentPage: 'daftar-dosen',
      role: 'kaprodi',
      activePage: 'daftar-dosen',
      dosen
    });
  } catch (err) {
    console.error('❌ ERROR renderDaftarDosen:', err);
    res.status(500).send('Terjadi kesalahan saat mengambil daftar dosen');
  }
};

module.exports = {
  renderDaftarDosen
};
