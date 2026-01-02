// controllers/admin/jadwalController.js
const Jadwal = require('../../models/jadwalModel');

const jadwalController = {

  // =========================================================================
  // 📅 1. CALENDAR VIEW (ADMIN) - Melihat Semua Jadwal
  // =========================================================================
// =========================================================================
  // 📅 1. CALENDAR VIEW (ADMIN) - Melihat Semua Jadwal
  // =========================================================================
  calendarView: async (req, res) => {
    try {
      const jadwalList = await Jadwal.getAllJadwal();

      const events = jadwalList.map(j => {
        const tanggal = j.tanggal; 
        const jamMulai = j.jam_mulai ? j.jam_mulai.slice(0, 5) : '00:00';
        const jamSelesai = j.jam_selesai ? j.jam_selesai.slice(0, 5) : '00:00';

        // Perbaikan: Tambahkan pengecekan agar tidak error 500 jika data null
        const namaMhs = j.nama || 'Tanpa Nama';
        const modeUjian = j.pelaksanaan ? j.pelaksanaan.toUpperCase() : '???';

        return {
          title: `${namaMhs} - (${modeUjian})`,
          start: `${tanggal}T${jamMulai}`,
          end: `${tanggal}T${jamSelesai}`,
          extendedProps: {
            npm: j.npm,
            mode: j.pelaksanaan || '-',
            status: j.status_label || 'Pending',
            tempat: j.tempat || '-',
            tahun_ajaran: `${j.nama_tahun || ''} - ${j.semester || ''}`,
            dosbing1: j.dosbing1 || '-',
            dosbing2: j.dosbing2 || '-',
            penguji: j.dosen_penguji || 'Belum Ditentukan'
          }
        };
      });

      res.render('admin/jadwal-ujian', {
        title: 'Kalender Ujian Akhir',
        currentPage: 'jadwal-ujian',
        role: 'admin',
        user: req.session.user,
        events: JSON.stringify(events) 
      });

    } catch (err) {
      console.error('❌ Error ambil jadwal:', err);
      res.status(500).send('Gagal menampilkan kalender admin.');
    }
  },


  // =========================================================================
  // 🎓 2. RENDER ISI JADWAL (MAHASISWA) - Booking & Status
  // =========================================================================
  renderIsiJadwal: async (req, res) => {
    try {
      const npm = req.session.user.npm;
      // Mengambil jadwal spesifik mahasiswa yang sedang login
      const jadwalList = await Jadwal.getJadwalByNPM(npm); 

      const events = jadwalList.map(j => {
        const tanggal = j.tanggal;
        const jamMulai = j.jam_mulai ? j.jam_mulai.slice(0, 5) : '00:00';
        const jamSelesai = j.jam_selesai ? j.jam_selesai.slice(0, 5) : '00:00';

        return {
          title: 'Jadwal Anda (Soft Booking)',
          start: `${tanggal}T${jamMulai}`,
          end: `${tanggal}T${jamSelesai}`,
          color: j.status_label === 'Terverifikasi' ? '#28a745' : '#ffc107', // Hijau jika ACC, Kuning jika proses
          extendedProps: {
            npm: j.npm,
            mode: j.pelaksanaan,
            status: j.status_label,
            tempat: j.tempat,
            nama_tahun: j.nama_tahun,
            semester: j.semester,
            dosbing1: j.dosbing1,
            dosbing2: j.dosbing2,
            penguji: j.penguji || 'Menunggu Verifikasi'
          }
        };
      });

      res.render('mahasiswa/isi-jadwal', {
        title: 'Isi Jadwal Ujian',
        role: 'mahasiswa',
        user: req.session.user,
        events: JSON.stringify(events)
      });

    } catch (err) {
      console.error('❌ Error load jadwal mahasiswa:', err);
      res.status(500).send('Gagal memuat jadwal pendaftaran.');
    }
  }
};

module.exports = jadwalController;