// controllers/kaprodi/dashboardKaprodiController

const { Dashboard } = require('../../models/adminDashboardModel'); 
const { TahunAjaran } = require('../../models/tahunAjaranModel');
const { Mahasiswa } = require('../../models/mahasiswaModel');
const { Dosbing } = require('../../models/dosbingModel');
// 🔥 PASTIKAN IMPORT MODEL PENGUJI SUDAH BENAR
const Penguji = require('../../models/pengujiModel'); 

const dashboardKaprodiController = {

  renderDashboard: async (req, res) => {
    try {
      const tahunAjarList = await Dashboard.getTahunAjarList();
      let selectedTahunId = req.query.tahun_ajaran || req.selectedTahunId || (tahunAjarList[0]?.id);

      let judulTahun = "Tahun Tidak Dipilih";
      if (selectedTahunId && tahunAjarList.length > 0) {
         const t = tahunAjarList.find(item => item.id == selectedTahunId);
         if (t) judulTahun = t.label; 
      }

      // Ambil data statistik (Terfilter berdasarkan tahun)
      const mahasiswa = await Mahasiswa.getAll(selectedTahunId);
      const ringkasan = await Dashboard.getRingkasanMahasiswa(selectedTahunId);
      const statistikRingkas = await Dashboard.getStatistikRingkas(selectedTahunId);
      const breakdownTahun = await Dashboard.getStatistikLengkapPerTahun();
      const rekapDosen = await Dosbing.getRekapPerDosen(selectedTahunId); 

      // 🔥 PERBAIKAN UTAMA: Ambil antrean dari model Penguji (UNIVERSAL)
      // Jangan gunakan Dashboard.getMahasiswaBelumPenguji karena logic-nya beda
      const antreanPenguji = await Penguji.getMahasiswaBelumPenguji(); 

      res.render('kaprodi/dashboard', {
        title: 'Dashboard Kaprodi',
        currentPage: 'dashboard',
        role: 'kaprodi',
        nama: req.session.user?.nama || 'Bapak/Ibu Kaprodi',
        
        selectedTahunId,
        judulTahun,
        rekapDosen,
        tahunAjarList,
        mahasiswa,
        breakdownTahun,
        
        // Kirim data antrean universal ke view
        antreanPenguji, 

        jumlahMahasiswa: ringkasan.jumlahMahasiswa,
        belumDaftar: ringkasan.belumDaftar,
        menungguUjian: ringkasan.menungguUjian,
        sudahUjian: ringkasan.sudahUjian,
        
        statistikRingkas,
        
        showBarChart: true,
        showPieChart: true
      });

    } catch (err) {
      console.error('❌ Error renderDashboardKaprodi:', err);
      res.status(500).send('Terjadi kesalahan saat mengambil data dashboard Kaprodi');
    }
  },
  // ... sisanya sama

  // ===========================================================
  // 📊 API CHARTS (Tetap sama)
  // ===========================================================
  getBarChart: async (req, res) => {
    try {
      res.json(await Dashboard.getBarChart(req.query.tahun));
    } catch (err) {
      console.error(err);
      res.json([]);
    }
  },

  getPieChart: async (req, res) => {
    try {
      res.json(await Dashboard.getPieChart(req.query.tahun));
    } catch (err) {
      console.error(err);
      res.json([]);
    }
  },

  getStatTahun: async (req, res) => {
    try {
      res.json(await Dashboard.getStatTahun());
    } catch (err) {
      console.error(err);
      res.json([]);
    }
  },
};

module.exports = dashboardKaprodiController;