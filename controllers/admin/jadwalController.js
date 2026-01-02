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
  const mode = (j.pelaksanaan || 'offline').toLowerCase();
  
  return {
    title: `${j.nama} - (${mode.toUpperCase()})`,
    start: `${j.tanggal}T${j.jam_mulai.slice(0,5)}`,
    end: `${j.tanggal}T${j.jam_selesai.slice(0,5)}`,
    
    // Memberikan warna background berbeda berdasarkan label status pelaksanaan
    backgroundColor: mode === 'online' ? '#0dcaf0' : '#198754',
    borderColor: mode === 'online' ? '#0dcaf0' : '#198754',
    
    extendedProps: {
      mode: mode,
      // pastikan semua properti modal ini terisi
      tahun_ajaran: `${j.nama_tahun || ''} - ${j.semester || ''}`,
      tempat: j.tempat || '-',
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