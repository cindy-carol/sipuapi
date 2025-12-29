const { TahunAjaran } = require('../../models/tahunAjaranModel');
const { getAllMahasiswaMonitoring, getStatistikPerAngkatan } = require('../../models/monitoringModel');

// 🟢 TAMPIL HALAMAN MONITORING
const getMonitoringMahasiswa = async (req, res) => {
  try {
    // 1. 🔥 AMBIL 'tab' DARI URL
    const { upload, verif, penguji, tab } = req.query;

    // 2. 🔥 TENTUKAN DEFAULT TAB
    // Kalau 'tab' kosong (undefined), paksa jadi 'monitoring'
    const activeTab = tab || 'monitoring';

    // 3. AMBIL LIST TAHUN
    const tahunAjarList = await TahunAjaran.getListForSelect();
    let selectedTahunId = req.query.tahun_ajaran || req.selectedTahunId || (tahunAjarList[0]?.id);

    // 4. AMBIL DATA
    const mahasiswaList = await getAllMahasiswaMonitoring(selectedTahunId);
    const statistikRingkas = await getStatistikPerAngkatan(selectedTahunId);

    // Filter opsional
    let filteredList = mahasiswaList;
    if (upload) filteredList = filteredList.filter(m => (upload === 'Ya') === !!m.uploadBerkas);
    if (verif) filteredList = filteredList.filter(m => (verif === 'Ya') === !!m.jadwalUjianDone);
    if (penguji) filteredList = filteredList.filter(m => (penguji === 'Ya') === !!m.penguji);

    res.render('kaprodi/monitoring', {
      title: 'Monitoring Mahasiswa',
      currentPage: 'monitoring',
      role: 'kaprodi',
      mahasiswaList: filteredList,
      tahunAjarList,
      selectedTahunId,
      statistikRingkas,
      filter: { upload, verif, penguji },
      
      // 5. 🔥 KIRIM VARIABEL INI (KUNCI PERBAIKANNYA)
      // Tanpa baris ini, halaman akan blank (karena activeTab undefined)
      activeTab: activeTab 
    });
  } catch (err) {
    console.error('Error getMonitoringMahasiswa:', err);
    res.status(500).send('Gagal mengambil data mahasiswa');
  }
};

const getMonitoringJadwal = async (req, res) => {
  try {
    const selectedTahunId = req.query.tahun_ajaran || null;
    let mahasiswaList = await getAllMahasiswaMonitoring(selectedTahunId);

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
    console.error('Error getMonitoringJadwal:', err);
    res.status(500).send('Gagal mengambil data jadwal');
  }
};

module.exports = { getMonitoringMahasiswa, getMonitoringJadwal };