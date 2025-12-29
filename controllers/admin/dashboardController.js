const { Dashboard } = require('../../models/adminDashboardModel.js');
const { TahunAjaran } = require('../../models/tahunAjaranModel.js');
const { Mahasiswa } = require('../../models/mahasiswaModel.js');

const dashboardController = {

renderDashboard: async (req, res) => {
  try {
    // 1. Ambil Data Rincian
    const dataRincian = await Dashboard.getAllRincian();
    
    // 2. Ambil List Tahun untuk Dropdown
    const tahunAjarList = await TahunAjaran.getListForSelect();

    // LOGIKA BARU: Tentukan ID Tahun Aktif
    // Jika ada di URL (?tahun_ajaran=5) pakai itu. Jika tidak, pakai tahun terbaru dari list.
let selectedTahunId = req.query.tahun_ajaran || req.selectedTahunId || (tahunAjarList[0]?.id);

    // 3. Ambil Data Statistik (Berdasarkan ID yang sudah fix tadi)
    const mahasiswa = await Mahasiswa.getAll(selectedTahunId);
    const ringkasan = await Dashboard.getRingkasanMahasiswa(selectedTahunId);
    const statistikRingkas = await Dashboard.getStatistikRingkas(selectedTahunId);

    const breakdownTahun = await Dashboard.getStatistikLengkapPerTahun();

    // 4. Mapping Kartu Editable
    const editableCards = dataRincian.map(item => ({
      id: item.id,
      title: item.judul || 'Tanpa Judul',
      content: item.keterangan || '-'
    }));

    // 5. Render View
    res.render('admin/dashboard', {
      title: 'Dashboard Admin',
      currentPage: 'dashboard',
      role: 'Admin',
      nama: req.session.user ? req.session.user.nama : 'Admin',
      
      tahunAjarList, 
      selectedTahunId,
      judulTahun,
      breakdownTahun: breakdownTahun,
      
      // Data Statistik
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
          name: 'db_skripsi (Connected)',
          count: dataRincian.length
      }
    });

  } catch (err) {
    console.error('❌ ERROR RENDER DASHBOARD:', err);
    res.status(500).send("Server Error");
  }
},

  // === CRUD Functions ===
  addRincian: async (req, res) => {
    try {
      // Pastikan form di view menggunakan name="title" dan name="content"
      await Dashboard.addRincian(req.body.title, req.body.content, req.session.user.id);
      res.redirect('/admin/dashboard');
    } catch (err) { 
      console.error("Gagal Add:", err); 
      res.redirect('/admin/dashboard'); 
    }
  },

// File: controllers/dashboardController.js

updateRincian: async (req, res) => {
  try {
    // 1. Update ke Database
    await Dashboard.updateRincian(
      req.body.id, 
      req.body.title, 
      req.body.content, 
      req.session.user.id
    );
    
    // 2. Jawab pakai JSON (WAJIB BUAT INLINE EDIT)
    res.json({ 
      success: true, 
      message: 'Data berhasil diupdate!' 
    });
    
  } catch (err) { 
    console.error("Gagal Update:", err); 
    // Jawab error pakai JSON juga
    res.status(500).json({ 
      success: false, 
      message: 'Gagal update database' 
    }); 
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

  // === API Charts ===
  // Menggunakan try-catch agar jika ada fungsi chart yang belum ada di model, web tidak crash
  getBarChart: async (req, res) => { 
    try { res.json(await Dashboard.getBarChart(req.query.tahun)); } catch(e){ console.error(e); res.json([]); }
  },
  getPieChart: async (req, res) => { 
    try { res.json(await Dashboard.getPieChart(req.query.tahun)); } catch(e){ console.error(e); res.json([]); }
  },
  getStatAngkatan: async (req, res) => { 
    try { res.json(await Dashboard.getStatAngkatan(req.query.tahun)); } catch(e){ console.error(e); res.json([]); }
  },
  getStatTahun: async (req, res) => { 
    try { res.json(await Dashboard.getStatTahun()); } catch(e){ console.error(e); res.json([]); }
  }
};

module.exports = dashboardController;