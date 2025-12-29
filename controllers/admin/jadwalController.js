const Jadwal = require('../../models/jadwalModel');

const jadwalController = {

  // =========================
  // 1️⃣ Kalender untuk ADMIN
  // =========================
  calendarView: async (req, res) => {
    try {
      const jadwalList = await Jadwal.getAllJadwal();

      const events = jadwalList.map(j => {
        // 🔥 FIX 1: Hapus toISOString(). Langsung ambil string tanggalnya.
        const tanggal = j.tanggal; 
        const jamMulai = j.jam_mulai.slice(0, 5);
        const jamSelesai = j.jam_selesai.slice(0, 5);

        return {
          title: `${j.nama} - ${j.npm} - (${j.pelaksanaan})`,
          // 🔥 FIX 2: Langsung gabung string (YYYY-MM-DD + T + HH:mm)
          start: `${tanggal}T${jamMulai}`,
          end: `${tanggal}T${jamSelesai}`,
          extendedProps: {
            mode: j.pelaksanaan,
            status: j.status_label,
            tempat: j.tempat,

            // Tahun ajaran
            tahun_ajaran: `${j.nama_tahun} - ${j.semester}`,

            // Dosen pembimbing
            dosbing1: j.dosbing1,
            dosbing2: j.dosbing2,

            // Dosen penguji
            penguji: j.dosen_penguji
          }
        };
      });

      res.render('admin/jadwal-ujian', {
        title: 'Kalender Ujian',
        currentPage: 'jadwal-ujian',
        role: 'admin',
        user: req.session.user,
        events: JSON.stringify(events)
      });

    } catch (err) {
      console.error('❌ Error ambil jadwal:', err);
      res.status(500).send('Gagal menampilkan kalender.');
    }
  },


  // =========================
  // 2️⃣ Kalender Mahasiswa (Isi Jadwal)
  // =========================
  renderIsiJadwal: async (req, res) => {
    try {
      const npm = req.session.user.npm;
      const jadwalList = await Jadwal.getJadwalByNPM(npm); 

      const events = jadwalList.map(j => {
        // 🔥 FIX 3: Di sini juga hapus toISOString()
        const tanggal = j.tanggal;
        const jamMulai = j.jam_mulai.slice(0, 5);
        const jamSelesai = j.jam_selesai.slice(0, 5);

        return {
          title: 'Soft Booking (Anda)',
          // 🔥 FIX 4: Langsung gabung string
          start: `${tanggal}T${jamMulai}`,
          end: `${tanggal}T${jamSelesai}`,
          extendedProps: {
            npm: j.npm,
            mode: j.pelaksanaan,
            status: j.status_label, // Pastikan field ini ada di query getJadwalByNPM
            tempat: j.tempat,

            // Tahun ajaran
            nama_tahun: j.nama_tahun,
            semester: j.semester,

            // Dosen pembimbing
            dosbing1: j.dosbing1,
            dosbing2: j.dosbing2,

            // Dosen penguji
            penguji: j.penguji
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
      console.error(err);
      res.status(500).send('Gagal load halaman isi jadwal');
    }
  }
};

module.exports = jadwalController;