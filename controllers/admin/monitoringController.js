const ExcelJS = require('exceljs');
const { TahunAjaran } = require('@models/tahunAjaranModel.js');
const { getAllMahasiswaMonitoring, getStatistikPerAngkatan } = require('@models/monitoringModel.js');

// 🟢 TAMPIL HALAMAN MONITORING
const getMonitoringMahasiswa = async (req, res) => {
  try {
    const { upload, verif, penguji } = req.query;
let selectedTahunId = req.query.tahun_ajaran || req.selectedTahunId || (tahunAjarList[0]?.id);

    const tahunAjarList = await TahunAjaran.getListForSelect();
    const mahasiswaList = await getAllMahasiswaMonitoring(selectedTahunId);
    const statistikRingkas = await getStatistikPerAngkatan(selectedTahunId);

    // Filter opsional
    let filteredList = mahasiswaList;
    if (upload) filteredList = filteredList.filter(m => (upload === 'Ya') === !!m.uploadBerkas);
    if (verif) filteredList = filteredList.filter(m => (verif === 'Ya') === !!m.jadwalUjianDone);
    if (penguji) filteredList = filteredList.filter(m => (penguji === 'Ya') === !!m.penguji);

    res.render('admin/monitoring', {
      title: 'Monitoring Mahasiswa',
      currentPage: 'monitoring',
      role: 'admin',
      mahasiswaList: filteredList,
      tahunAjarList,
      selectedTahunId,
      statistikRingkas,
      filter: { upload, verif, penguji }
    });
  } catch (err) {
    console.error('Error getMonitoringMahasiswa:', err);
    res.status(500).send('Gagal mengambil data mahasiswa');
  }
};

// 🟢 EXPORT KE EXCEL
const exportMonitoringExcel = async (req, res) => {
  try {
    const selectedTahunId = req.query.tahun_ajaran || null;
    const mahasiswaList = await getAllMahasiswaMonitoring(selectedTahunId);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Monitoring Mahasiswa');

    sheet.columns = [
      { header: 'NPM', key: 'npm', width: 15 },
      { header: 'Nama', key: 'nama', width: 25 },
      { header: 'Dosen Pembimbing 1', key: 'dosbing1', width: 30 },
      { header: 'Dosen Pembimbing 2', key: 'dosbing2', width: 30 },
      { header: 'Penguji', key: 'penguji', width: 30 },
      { header: 'Tahun Ajaran', key: 'tahunAjaran', width: 20 },
      { header: 'Jadwal Ujian', key: 'jadwal', width: 35 },
      { header: 'Upload Dokumen', key: 'upload', width: 15 },
      { header: 'Verifikasi Dokumen', key: 'verif', width: 15 },
      { header: 'Surat Undangan', key: 'suratUndangan', width: 15 },
      { header: 'Sudah Ujian', key: 'sudahUjian', width: 15 },
    ];

    mahasiswaList.forEach(m => {
      sheet.addRow({
        npm: m.npm,
        nama: m.nama,
        dosbing1: m.dosbing[0] || '',
        dosbing2: m.dosbing[1] || '',
        penguji: (m.pengujiNama || []).join(', '),
        tahunAjaran: m.tahunAjaran,
        jadwal: m.jadwalUjian,
        upload: m.uploadBerkas ? 'Ya' : 'Tidak',
        verif: m.verifBerkas ? 'Ya' : 'Tidak',
        suratUndangan: m.suratUndangan ? 'Ya' : 'Tidak',
        sudahUjian: m.sudahUjian ? 'Ya' : 'Tidak',
      });
    });

    // Set header supaya browser langsung download
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=monitoring-mahasiswa.xlsx'
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal membuat Excel');
  }
};

module.exports = { getMonitoringMahasiswa, exportMonitoringExcel };
