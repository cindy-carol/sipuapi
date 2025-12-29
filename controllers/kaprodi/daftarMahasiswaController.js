// controllers/kaprodi/daftarMahasiswaController.js
const { Mahasiswa } = require('../../models/mahasiswaModel');
const { TahunAjaran } = require('../../models/tahunAjaranModel');

/**
 * ============================================================
 * 📄 RENDER: Halaman Daftar Mahasiswa (Sisi Kaprodi)
 * ============================================================
 * Fungsi ini digunakan untuk menampilkan list mahasiswa berdasarkan
 * filter Tahun Ajaran yang dipilih.
 */
const renderDaftarMahasiswa = async (req, res) => {
  try {
    // 1. Ambil daftar tahun ajaran untuk dropdown filter
    const tahunAjarList = await TahunAjaran.getListForSelect();

    // 2. Tentukan ID Tahun Ajaran yang dipilih (dari query URL atau default tahun terbaru)
    const selectedTahunId = req.query.tahun_ajaran || (tahunAjarList.length > 0 ? tahunAjarList[0].id : null);

    // 3. Ambil data mahasiswa berdasarkan tahun ajaran terpilih
    const mahasiswa = await Mahasiswa.getAll(selectedTahunId);

    // 4. Kirim data ke view kaprodi/daftar-mahasiswa
    res.render('kaprodi/daftar-mahasiswa', {  
      title: 'Daftar Mahasiswa',  
      currentPage: 'daftar-mahasiswa',  
      role: 'kaprodi',  
      activePage: 'daftar-mahasiswa',  
      mahasiswa,  
      tahunAjarList,  
      selectedTahunId  
    });  
  } catch (err) {
    // Log error untuk monitoring di dashboard Vercel
    console.error('❌ ERROR renderDaftarMahasiswa:', err);
    res.status(500).send('Terjadi kesalahan saat mengambil daftar mahasiswa.');
  }
};

module.exports = {
  renderDaftarMahasiswa
};