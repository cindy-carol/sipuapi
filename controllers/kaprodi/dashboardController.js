// controllers/kaprodi/dashboardKaprodiController.js

const { Dashboard } = require('../../models/adminDashboardModel'); 
const { TahunAjaran } = require('../../models/tahunAjaranModel');
const { Mahasiswa } = require('../../models/mahasiswaModel');
const { Dosbing } = require('../../models/dosbingModel');
// Import model Penguji untuk menangani antrean penetapan dosen penguji
const Penguji = require('../../models/pengujiModel'); 

const dashboardKaprodiController = {

  // =========================================================================
  // 📊 1. RENDER DASHBOARD KAPRODI
  // =========================================================================
  renderDashboard: async (req, res) => {
    try {
      // 1. Ambil list tahun ajaran untuk dropdown filter
      const tahunAjarList = await Dashboard.getTahunAjarList();
      
      // 2. Tentukan ID Tahun Aktif (dari Query URL atau default tahun terbaru)
      let selectedTahunId = req.query.tahun_ajaran || req.selectedTahunId || (tahunAjarList[0]?.id);

      // 3. Set Label Judul Tahun untuk tampilan Header Dashboard
      let judulTahun = "Tahun Tidak Dipilih";
      if (selectedTahunId && tahunAjarList.length > 0) {
          const t = tahunAjarList.find(item => item.id == selectedTahunId);
          if (t) judulTahun = t.label; 
      }

      // 4. Ambil Data Statistik secara Paralel (Optimasi Performa Vercel)
      const [
          mahasiswa, 
          ringkasan, 
          statistikRingkas, 
          breakdownTahun, 
          rekapDosen,
          antreanPenguji // 🔥 Data Antrean Universal
      ] = await Promise.all([
          Mahasiswa.getAll(selectedTahunId),
          Dashboard.getRingkasanMahasiswa(selectedTahunId),
          Dashboard.getStatistikRingkas(selectedTahunId),
          Dashboard.getStatistikLengkapPerTahun(),
          Dosbing.getRekapPerDosen(selectedTahunId),
          Penguji.getMahasiswaBelumPenguji() 
      ]);

      // 5. Render View kaprodi/dashboard
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
        
        // Data antrean penetapan penguji
        antreanPenguji, 

        // Data Ringkasan Statistik
        jumlahMahasiswa: ringkasan.jumlahMahasiswa || 0,
        belumDaftar: ringkasan.belumDaftar || 0,
        menungguUjian: ringkasan.menungguUjian || 0,
        sudahUjian: ringkasan.sudahUjian || 0,
        
        statistikRingkas,
        
        showBarChart: true,
        showPieChart: true
      });

    } catch (err) {
      console.error('❌ Error renderDashboardKaprodi:', err);
      res.status(500).send('Terjadi kesalahan saat mengambil data dashboard Kaprodi');
    }
  },

  // =========================================================================
  // 📈 2. API CHARTS (Dibutuhkan oleh Chart.js di sisi Frontend)
  // =========================================================================
  getBarChart: async (req, res) => {
    try {
      res.json(await Dashboard.getBarChart(req.query.tahun));
    } catch (err) {
      console.error('❌ Error API BarChart:', err);
      res.json([]);
    }
  },

  getPieChart: async (req, res) => {
    try {
      res.json(await Dashboard.getPieChart(req.query.tahun));
    } catch (err) {
      console.error('❌ Error API PieChart:', err);
      res.json([]);
    }
  },

  getStatTahun: async (req, res) => {
    try {
      res.json(await Dashboard.getStatTahun());
    } catch (err) {
      console.error('❌ Error API StatTahun:', err);
      res.json([]);
    }
  },
};

module.exports = dashboardKaprodiController;