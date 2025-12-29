// controllers/kaprodi/monitoringController.js
const { TahunAjaran } = require('../../models/tahunAjaranModel');
const { getAllMahasiswaMonitoring, getStatistikPerAngkatan } = require('../../models/monitoringModel');

/**
 * ============================================================
 * 🟢 1. TAMPIL HALAMAN MONITORING (KAPRODI)
 * ============================================================
 * Fungsi ini menangani tampilan monitoring mahasiswa per angkatan
 * dengan sistem tab (Monitoring & Statistik).
 */
const getMonitoringMahasiswa = async (req, res) => {
  try {
    // 1. Ambil Parameter dari URL
    const { upload, verif, penguji, tab } = req.query;

    // 2. Tentukan Default Tab (Kunci perbaikan agar UI tidak blank)
    const activeTab = tab || 'monitoring';

    // 3. Ambil List Tahun Ajaran untuk Dropdown Filter
    const tahunAjarList = await TahunAjaran.getListForSelect();
    
    // Tentukan ID Tahun terpilih (Default ke tahun terbaru di list)
    let selectedTahunId = req.query.tahun_ajaran || (tahunAjarList[0]?.id);

    // 4. Ambil Data secara Paralel (Optimasi Serverless)
    const [mahasiswaList, statistikRingkas] = await Promise.all([
        getAllMahasiswaMonitoring(selectedTahunId),
        getStatistikPerAngkatan(selectedTahunId)
    ]);

    // 5. Filter Opsional (Sisi Server)
    let filteredList = mahasiswaList;
    if (upload) filteredList = filteredList.filter(m => (upload === 'Ya') === !!m.uploadBerkas);
    if (verif) filteredList = filteredList.filter(m => (verif === 'Ya') === !!m.jadwalUjianDone);
    if (penguji) filteredList = filteredList.filter(m => (penguji === 'Ya') === !!m.penguji);

    // 6. Render View
    res.render('kaprodi/monitoring', {
      title: 'Monitoring Mahasiswa',
      currentPage: 'monitoring',
      role: 'kaprodi',
      mahasiswaList: filteredList,
      tahunAjarList,
      selectedTahunId,
      statistikRingkas,
      filter: { upload, verif, penguji },
      
      // Mengirimkan variabel activeTab agar frontend tahu tab mana yang harus dibuka
      activeTab: activeTab 
    });
  } catch (err) {
    console.error('❌ Error getMonitoringMahasiswa:', err);
    res.status(500).send('Gagal mengambil data monitoring mahasiswa.');
  }
};

/**
 * ============================================================
 * 🟢 2. REKAP JADWAL UJIAN
 * ============================================================
 */
const getMonitoringJadwal = async (req, res) => {
  try {
    const selectedTahunId = req.query.tahun_ajaran || null;
    let mahasiswaList = await getAllMahasiswaMonitoring(selectedTahunId);

    // Mapping data agar sesuai dengan format tampilan rekap
    mahasiswaList = mahasiswaList.map(m => ({
      ...m,
      penguji: m.pengujiTungguList || [], 
      jadwalUjian: m.jadwal || ''
    }));

    res.render('admin/rekapJadwal', {
      title: 'Rekap Jadwal Ujian',
      currentPage: 'jadwal',
      mahasiswaList,
      selectedTahunId
    });
  } catch (err) {
    console.error('❌ Error getMonitoringJadwal:', err);
    res.status(500).send('Gagal mengambil data rekap jadwal.');
  }
};

module.exports = { getMonitoringMahasiswa, getMonitoringJadwal };