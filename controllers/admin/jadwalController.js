// controllers/admin/jadwalController.js
const Jadwal = require('../../models/jadwalModel');

const jadwalController = {

  // =========================================================================
  // 📅 1. CALENDAR VIEW (ADMIN) - Melihat Semua Jadwal
  // =========================================================================
calendarView: async (req, res) => {
    try {
      const jadwalList = await Jadwal.getAllJadwal();

// Gantilah bagian .map di calendarView dengan ini:
const events = jadwalList.map(j => {
  // PENGAMAN: Cek apakah jam_mulai dan jam_selesai ada isinya sebelum di-slice
  const jamMulai = (j.jam_mulai && typeof j.jam_mulai === 'string') ? j.jam_mulai.slice(0, 5) : '08:00';
  const jamSelesai = (j.jam_selesai && typeof j.jam_selesai === 'string') ? j.jam_selesai.slice(0, 5) : '09:00';
  const tanggal = j.tanggal || '2026-01-01'; // Fallback tanggal jika kosong

  // Agar pelaksanaan jadi label status (ONLINE/OFFLINE)
  const modeUjian = (j.pelaksanaan || 'offline').toUpperCase();

  return {
    title: `${j.nama || 'Tanpa Nama'} - (${modeUjian})`,
    start: `${tanggal}T${jamMulai}`,
    end: `${tanggal}T${jamSelesai}`,
    // Atur warna label otomatis
    backgroundColor: modeUjian === 'ONLINE' ? '#0dcaf0' : '#198754',
    borderColor: modeUjian === 'ONLINE' ? '#0dcaf0' : '#198754',
    extendedProps: {
      mode: j.pelaksanaan || 'offline',
      status: j.status_label || 'Pending',
      tempat: j.tempat || '-',
      tahun_ajaran: j.nama_tahun ? `${j.nama_tahun} - ${j.semester}` : '-',
      dosbing1: j.dosbing1 || '-',
      dosbing2: j.dosbing2 || '-',
      penguji: j.dosen_penguji || j.penguji || 'Belum Ditentukan'
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