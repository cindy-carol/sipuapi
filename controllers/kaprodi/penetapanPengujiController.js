// controllers/kaprodi/penetapanPengujiController.js
const { 
    getMahasiswaBelumPenguji, 
    getMahasiswaSudahPenguji, 
    getAllDosen 
} = require('../../models/pengujiModel');
const { Mahasiswa } = require('../../models/mahasiswaModel');
const { TahunAjaran } = require('../../models/tahunAjaranModel');
const { getQuickViewStat } = require('../../models/monitoringModel');

/**
 * ============================================================
 * ⚖️ RENDER: Halaman Penetapan Penguji (Sisi Kaprodi)
 * ============================================================
 * Menampilkan antrean mahasiswa yang sudah siap ujian namun
 * belum memiliki dosen penguji, serta riwayat yang sudah tetap.
 */
const getPenetapanPenguji = async (req, res) => {
  try {
    // 1. Ambil filter Tahun Ajaran dari Query URL
    const selectedTahunId = req.query.tahun_ajaran || null;

    // 2. 🔥 PARALLEL FETCH (Optimasi Vercel Serverless)
    // Menjalankan semua query sekaligus agar response time minimal
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
      getMahasiswaBelumPenguji(selectedTahunId),
      getMahasiswaSudahPenguji(selectedTahunId),
      getAllDosen(),
      getQuickViewStat()
    ]);

    // 3. Ambil statistik cepat (Quick View) untuk periode yang sedang dipilih
    const quickCurrent = selectedTahunId
      ? quickView.find(q => q.tahun_id == selectedTahunId)
      : null;

    // 4. Render ke view 'kaprodi/penetapan-penguji'
    res.render('kaprodi/penetapan-penguji', {
      title: 'Penetapan Dosen Penguji',
      currentPage: 'penetapan-penguji',
      role: 'kaprodi',
      mahasiswa,
      tahunAjarList,
      selectedTahunId,
      mahasiswaBelum,
      mahasiswaSudah,
      dosenList,
      quickCurrent,
      quickView
    });

  } catch (err) {
    // Log error lengkap di dashboard monitoring Vercel
    console.error('❌ Error getPenetapanPenguji:', err);
    res.status(500).send('Terjadi kesalahan sistem saat memuat data penetapan penguji.');
  }
};

module.exports = {
  getPenetapanPenguji
};