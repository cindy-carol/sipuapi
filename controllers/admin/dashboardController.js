// controllers/admin/dashboardController.js
const { Dashboard } = require('../../models/adminDashboardModel');
const { TahunAjaran } = require('../../models/tahunAjaranModel');
const { Mahasiswa } = require('../../models/mahasiswaModel');

const dashboardController = {

  // =========================================================================
  // 📊 1. RENDER DASHBOARD (Statistik & Kartu Rincian)
  // =========================================================================
  renderDashboard: async (req, res) => {
    try {
      // 1. Ambil Data Rincian (Teks Pengumuman/Info di Dashboard)
      const dataRincian = await Dashboard.getAllRincian();
      
      // 2. Ambil List Tahun untuk Dropdown Filter
      const tahunAjarList = await TahunAjaran.getListForSelect();

      // Tentukan ID Tahun Aktif: Dari URL atau default ke tahun pertama di list
      let selectedTahunId = req.query.tahun_ajaran || (tahunAjarList[0]?.id);

      // Cari Judul Tahun Ajaran untuk tampilan Header
      const currentYearObj = tahunAjarList.find(t => t.id == selectedTahunId);
      const judulTahun = currentYearObj ? `${currentYearObj.nama_tahun} - ${currentYearObj.semester}` : 'Pilih Tahun Ajaran';

      // 3. Ambil Data Statistik Berdasarkan Filter Tahun
      const mahasiswa = await Mahasiswa.getAll(selectedTahunId);
      const ringkasan = await Dashboard.getRingkasanMahasiswa(selectedTahunId);
      const statistikRingkas = await Dashboard.getStatistikRingkas(selectedTahunId);
      const breakdownTahun = await Dashboard.getStatistikLengkapPerTahun();

      // 4. Mapping Kartu Editable (Info Box di Dashboard)
      const editableCards = dataRincian.map(item => ({
        id: item.id,
        title: item.judul || 'Tanpa Judul',
        content: item.keterangan || '-'
      }));

      // 5. Render View admin/dashboard
      res.render('admin/dashboard', {
        title: 'Dashboard Admin',
        currentPage: 'dashboard',
        role: 'Admin',
        nama: req.session.user ? req.session.user.nama : 'Admin',
        
        tahunAjarList, 
        selectedTahunId,
        judulTahun,
        breakdownTahun: breakdownTahun,
        
        // Data Statistik Mahasiswa
        jumlahMahasiswa: ringkasan.jumlahMahasiswa,
        belumDaftar: ringkasan.belumDaftar,
        menungguUjian: ringkasan.menungguUjian,
        sudahUjian: ringkasan.sudahUjian,
        mahasiswaPerTahun: ringkasan.mahasiswaPerTahun,
        statistikRingkas, 
        mahasiswa,
        
        showBarChart: true, 
        showPieChart: true,
        editableCards,

        dbDebug: {
            name: 'PostgreSQL Cloud (Connected)',
            count: dataRincian.length
        }
      });

    } catch (err) {
      console.error('❌ ERROR RENDER DASHBOARD:', err);
      res.status(500).send("Server Error: Gagal memuat dashboard.");
    }
  },

  // =========================================================================
  // ✍️ 2. CRUD RINCIAN (Manajemen Konten Dashboard)
  // =========================================================================
  addRincian: async (req, res) => {
    try {
      await Dashboard.addRincian(req.body.title, req.body.content, req.session.user.id);
      res.redirect('/admin/dashboard');
    } catch (err) { 
      console.error("Gagal Add:", err); 
      res.redirect('/admin/dashboard'); 
    }
  },

  updateRincian: async (req, res) => {
    try {
      await Dashboard.updateRincian(
        req.body.id, 
        req.body.title, 
        req.body.content, 
        req.session.user.id
      );
      
      // Respon JSON untuk mendukung fitur Inline Edit di Frontend
      res.json({ success: true, message: 'Data berhasil diupdate!' });
    } catch (err) { 
      console.error("Gagal Update:", err); 
      res.status(500).json({ success: false, message: 'Gagal update database' }); 
    }
  },

  deleteRincian: async (req, res) => {
    try {
      await Dashboard.deleteRincian(req.params.id);
      res.redirect('/admin/dashboard');
    } catch (err) { 
      console.error("Gagal Delete:", err); 
      res.redirect('/admin/dashboard'); 
    }
  },

  // =========================================================================
  // 📊 3. API CHARTS (Untuk Grafik Interaktif)
  // =========================================================================
  getBarChart: async (req, res) => { 
    try { res.json(await Dashboard.getBarChart(req.query.tahun)); } catch(e){ res.json([]); }
  },
  getPieChart: async (req, res) => { 
    try { res.json(await Dashboard.getPieChart(req.query.tahun)); } catch(e){ res.json([]); }
  },
  getStatAngkatan: async (req, res) => { 
    try { res.json(await Dashboard.getStatAngkatan(req.query.tahun)); } catch(e){ res.json([]); }
  },
  getStatTahun: async (req, res) => { 
    try { res.json(await Dashboard.getStatTahun()); } catch(e){ res.json([]); }
  }
};

module.exports = dashboardController;