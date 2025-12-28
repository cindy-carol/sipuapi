const { getMahasiswaBelumPenguji, getMahasiswaSudahPenguji, getAllDosen } = require('@models/pengujiModel.js');
const { Mahasiswa } = require('@models/mahasiswaModel.js');
const { TahunAjaran } = require('@models/tahunAjaranModel.js');
const { getQuickViewStat } = require('@models/monitoringModel.js');

const getPenetapanPenguji = async (req, res) => {
  try {
    const selectedTahunId = req.query.tahun_ajaran || null;

    // 🔹 Ambil semua data utama secara paralel
    const [
      tahunAjarList,
      mahasiswa,
      mahasiswaBelum,
      mahasiswaSudah,
      dosenList,
      quickView
    ] = await Promise.all([
      TahunAjaran.getListForSelect(),
      Mahasiswa.getAll(selectedTahunId),
      getMahasiswaBelumPenguji(selectedTahunId),  // pake filter tahun ajaran
      getMahasiswaSudahPenguji(selectedTahunId),  // pake filter tahun ajaran
      getAllDosen(),
      getQuickViewStat()
    ]);

    // 🔹 Ambil quick view untuk tahun ajaran yang dipilih
    const quickCurrent = selectedTahunId
      ? quickView.find(q => q.tahun_id == selectedTahunId)
      : null;

    // 🔹 Render view
    res.render('kaprodi/penetapan-penguji', {
      title: 'Daftar Penetapan Penguji',
      currentPage: 'penetapan-penguji',
      role: 'kaprodi',
      mahasiswa,
      tahunAjarList,
      mahasiswaBelum,
      mahasiswaSudah,
      dosenList,
      quickCurrent,
      quickView
    });

  } catch (err) {
    console.error('Error getPenetapanPenguji:', err);
    res.status(500).send('Gagal memuat data penetapan penguji');
  }
};

module.exports = {
  getPenetapanPenguji
};
