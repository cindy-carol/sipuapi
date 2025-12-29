const { Mahasiswa } = require('../../models/mahasiswaModel');
const { TahunAjaran } = require('../../models/tahunAjaranModel');

/* ============================================================
🔹 RENDER: Halaman Daftar Mahasiswa
============================================================ */
const renderDaftarMahasiswa = async (req, res) => {
  try {
let selectedTahunId = req.query.tahun_ajaran || req.selectedTahunId || (tahunAjarList[0]?.id);// ambil dari query
    const mahasiswa = await Mahasiswa.getAll(selectedTahunId); // kirim ke model
    const tahunAjarList = await TahunAjaran.getListForSelect();

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
    console.error('❌ ERROR renderDaftarMahasiswa:', err);
    res.status(500).send('Terjadi kesalahan saat mengambil daftar mahasiswa');
  }
};

/* ============================================================
🔹 EXPORT CONTROLLERS
============================================================ */
module.exports = {
renderDaftarMahasiswa
};
