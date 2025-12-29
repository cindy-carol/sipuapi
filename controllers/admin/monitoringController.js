// controllers/admin/monitoringController.js
const ExcelJS = require('exceljs');
const { TahunAjaran } = require('../../models/tahunAjaranModel');
const { getAllMahasiswaMonitoring, getStatistikPerAngkatan } = require('../../models/monitoringModel');

// =========================================================================
// 🟢 1. TAMPIL HALAMAN MONITORING (WITH FILTER)
// =========================================================================
const getMonitoringMahasiswa = async (req, res) => {
  try {
    const { upload, verif, penguji } = req.query;
    const tahunAjarList = await TahunAjaran.getListForSelect();

    // Tentukan ID Tahun Ajaran yang dipilih (Default ke tahun terbaru di list)
    let selectedTahunId = req.query.tahun_ajaran || (tahunAjarList[0]?.id);

    // Ambil data monitoring dari database melalui model
    const mahasiswaList = await getAllMahasiswaMonitoring(selectedTahunId);
    const statistikRingkas = await getStatistikPerAngkatan(selectedTahunId);

    // Logika filter opsional berdasarkan query string
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
    console.error('❌ Error getMonitoringMahasiswa:', err);
    res.status(500).send('Gagal mengambil data monitoring mahasiswa');
  }
};

// =========================================================================
// 🟢 2. EXPORT KE EXCEL (MEMORY STREAM - VERCEL COMPATIBLE)
// =========================================================================
const exportMonitoringExcel = async (req, res) => {
  try {
    const selectedTahunId = req.query.tahun_ajaran || null;
    const mahasiswaList = await getAllMahasiswaMonitoring(selectedTahunId);

    // Inisialisasi Workbook ExcelJS
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Monitoring Mahasiswa');

    // Definisi Kolom Excel
    sheet.columns = [
      { header: 'No', key: 'no', width: 5 },
      { header: 'NPM', key: 'npm', width: 15 },
      { header: 'Nama', key: 'nama', width: 30 },
      { header: 'Dosen Pembimbing 1', key: 'dosbing1', width: 30 },
      { header: 'Dosen Pembimbing 2', key: 'dosbing2', width: 30 },
      { header: 'Penguji', key: 'penguji', width: 35 },
      { header: 'Tahun Ajaran', key: 'tahunAjaran', width: 25 },
      { header: 'Jadwal Ujian', key: 'jadwal', width: 40 },
      { header: 'Upload Dokumen', key: 'upload', width: 15 },
      { header: 'Verifikasi Dokumen', key: 'verif', width: 15 },
      { header: 'Surat Undangan', key: 'suratUndangan', width: 15 },
      { header: 'Sudah Ujian', key: 'sudahUjian', width: 15 },
    ];

    // Styling Header agar lebih profesional
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Masukkan data mahasiswa ke baris Excel
    mahasiswaList.forEach((m, index) => {
      sheet.addRow({
        no: index + 1,
        npm: m.npm,
        nama: m.nama,
        dosbing1: (m.dosbing && m.dosbing[0]) || '-',
        dosbing2: (m.dosbing && m.dosbing[1]) || '-',
        penguji: Array.isArray(m.pengujiNama) ? m.pengujiNama.join(', ') : (m.pengujiNama || '-'),
        tahunAjaran: m.tahunAjaran || '-',
        jadwal: m.jadwalUjian || '-',
        upload: m.uploadBerkas ? 'Ya' : 'Tidak',
        verif: m.verifBerkas ? 'Ya' : 'Tidak',
        suratUndangan: m.suratUndangan ? 'Ya' : 'Tidak',
        sudahUjian: m.sudahUjian ? 'Ya' : 'Tidak',
      });
    });

    // Pengaturan Header Respons HTTP 
    const fileName = `Monitoring-Mahasiswa-${Date.now()}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${fileName}`
    );

    // Menulis workbook langsung ke stream respon (Tanpa simpan file sementara)
    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('❌ Error exportMonitoringExcel:', err);
    res.status(500).send('Gagal membuat file Excel monitoring.');
  }
};

module.exports = { getMonitoringMahasiswa, exportMonitoringExcel };