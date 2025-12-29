// controllers/kaprodi/daftarDosenController.js
const { Dosen } = require('../../models/dosenModel');

/**
 * ============================================================
 * 📄 RENDER: Halaman Daftar Dosen (Sisi Kaprodi)
 * ============================================================
 * Fungsi ini hanya bersifat read-only untuk menampilkan daftar
 * seluruh dosen yang terdaftar di sistem.
 */
const renderDaftarDosen = async (req, res) => {
  try {
    // Mengambil data seluruh dosen dari database PostgreSQL
    const dosen = await Dosen.getAll();

    // Render view kaprodi/daftar-dosen dengan data yang ditarik
    res.render('kaprodi/daftar-dosen', {
      title: 'Daftar Dosen',
      currentPage: 'daftar-dosen',
      role: 'kaprodi',
      activePage: 'daftar-dosen',
      dosen
    });

  } catch (err) {
    // Log error ke console Vercel untuk debugging
    console.error('❌ ERROR renderDaftarDosen:', err);
    res.status(500).send('Terjadi kesalahan saat mengambil daftar dosen dari server.');
  }
};

module.exports = {
  renderDaftarDosen
};