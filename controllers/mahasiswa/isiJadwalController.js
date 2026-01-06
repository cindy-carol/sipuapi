// controllers/mahasiswa/isiJadwalController.js
const { Mahasiswa } = require('../../models/mahasiswaModel');
const { 
    getJadwalUjian, 
    saveJadwalMahasiswa, 
    deleteJadwalByNPM, 
    getJadwalByNPM 
} = require('../../models/jadwalModel');

/**
 * 🔧 HELPER: Format Tanggal ke YYYY-MM-DD
 * Penting untuk input type="date" di HTML5
 */
const formatDateInput = (date) => {
  if (!date) return '';
  if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) return date;
  const d = new Date(date);
  if (isNaN(d.getTime())) return ''; 
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ==========================================
// 1️⃣ GET: TAMPILKAN HALAMAN ISI JADWAL
// ==========================================
const getIsiJadwal = async (req, res) => {
  try {
    const npm = req.session.user.npm;

    // --- SATPAM 1: CEK STATUS BERKAS ---
    // Mahasiswa baru boleh isi jadwal kalau berkas WAJIB (RPL, Artikel, Asistensi 1) sudah ACC (Status 3)
    const statusBerkas = await Mahasiswa.getStatusBerkasByNPM(npm);
    if (statusBerkas.rpl !== 3 || statusBerkas.artikel !== 3 || statusBerkas.kartu_asistensi_1 !== 3) {
        if (req.flash) req.flash('error', '🚫 Akses Ditolak! Berkas Anda belum lengkap atau belum disetujui Admin.');
        return res.redirect('/mahasiswa/dashboard');
    }

    // --- AMBIL DATA PENDUKUNG ---
    const [mhs, allJadwal] = await Promise.all([
        Mahasiswa.findByNPM(npm),
        getJadwalUjian() // Mengambil semua jadwal untuk diletakkan di Kalender (Legenda)
    ]);

    // --- MAPPING DATA UNTUK FULLCALENDAR ---
    const events = allJadwal.map(j => {
      const isMyEvent = j.npm === npm;
      const dateStr = formatDateInput(j.tanggal); 
      const jamStart = (j.jam_mulai || '00:00:00').substring(0, 5);
      const jamEnd = (j.jam_selesai || '00:00:00').substring(0, 5);

      let warna, titleLabel, textColor;

      if (isMyEvent) {
        // Jadwal Milik Mahasiswa Ini
        if (j.status_verifikasi === true) {
          titleLabel = "Jadwal Anda (Disetujui)";
          warna = '#198754'; // Hijau Bootstrap
          textColor = '#ffffff';
        } else {
          titleLabel = "Jadwal Anda (Menunggu)";
          warna = '#ffc107'; // Kuning Bootstrap
          textColor = '#000000';
        }
      } else {
        // Jadwal Mahasiswa Lain (Hanya sebagai penanda/legenda)
        if (j.pelaksanaan === 'offline') {
          titleLabel = "OFFLINE"; 
          warna = '#343a40'; // Gelap
          textColor = '#ffffff';
        } else {
          titleLabel = "ONLINE";  
          warna = '#adb5bd'; // Abu-abu
          textColor = '#000000';
        }
      }

      return {
        title: titleLabel,
        start: `${dateStr}T${jamStart}`, 
        end: `${dateStr}T${jamEnd}`,
        backgroundColor: warna,
        borderColor: warna,
        textColor: textColor,
        extendedProps: {
          mode: j.pelaksanaan,
          status: j.status_verifikasi === true ? 'confirmed' : 'softbooked',
          owner: j.npm, 
          isMine: isMyEvent,
          dosenTerlibat: [j.dosbing1_id, j.dosbing2_id, j.dosen_penguji_id].filter(id => id != null)
        }
      };
    });

    const myDosenIds = [mhs.dosbing1_id, mhs.dosbing2_id].filter(id => id != null);
    
    // Cari jadwal saya sendiri untuk mengisi form edit jika sudah pernah isi
    let myJadwal = allJadwal.find(j => j.npm === npm);
    if (!myJadwal) {
        const myJadwalList = await getJadwalByNPM(npm);
        myJadwal = myJadwalList[0] || {};
    }

    res.render('mahasiswa/isi-jadwal', {
      title: 'Isi Jadwal Ujian',
      currentPage: 'isi-jadwal',
      role: 'mahasiswa',
      nama: mhs.nama,
      npm: mhs.npm,
      thajaran: `${mhs.nama_tahun} ${mhs.semester}`,
      dosbing1: mhs.nama_dosbing1,
      dosbing2: mhs.nama_dosbing2,
      myDosenIds: myDosenIds, 
      tempat: myJadwal.tempat || '',
      tanggal: formatDateInput(myJadwal.tanggal),
      jamMulai: myJadwal.jam_mulai ? myJadwal.jam_mulai.substring(0, 5) : '', 
      pelaksanaan: myJadwal.pelaksanaan || '',
      events: JSON.stringify(events) 
    });

  } catch (err) {
    console.error('❌ Error getIsiJadwal:', err);
    res.status(500).send('Terjadi kesalahan pada server saat memuat halaman jadwal.');
  }
};

// ==========================================
// 2️⃣ POST: PROSES SIMPAN JADWAL (AJAX)
// ==========================================
const postIsiJadwal = async (req, res) => {
  const { tanggal, jamMulai, jamSelesai, pelaksanaan, tempat } = req.body;
  const npm = req.session.user.npm;

  try {
    // Hitung jam selesai otomatis jika tidak dikirim (durasi default 60 menit)
    let finalJamSelesai = jamSelesai;
    if (!finalJamSelesai && jamMulai) {
        const [h, m] = jamMulai.split(':').map(Number);
        finalJamSelesai = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    
    // Simpan ke Model (Di dalam model biasanya ada pengecekan bentrok jadwal dosen/ruangan)
    await saveJadwalMahasiswa(npm, tanggal, jamMulai, finalJamSelesai, pelaksanaan, tempat);
    
    return res.status(200).json({
        success: true,
        message: 'Jadwal berhasil disimpan! Menunggu verifikasi admin.'
    });

  } catch (err) {
    console.error('❌ Gagal Simpan Jadwal:', err.message);
    return res.status(400).json({
        success: false,
        message: err.message // Menampilkan pesan error khusus (misal: "Dosen sedang sibuk")
    });
  }
};

// ==========================================
// 3️⃣ DELETE: BATALKAN JADWAL
// ==========================================
const hapusJadwal = async (req, res) => {
  try {
    const npm = req.session.user.npm;

    // 1. Cek dulu status jadwalnya sebelum dihapus
    const jadwal = await getJadwalByNPM(npm);
    
    // 2. Filter: Jika sudah diverifikasi (true), TOLAK penghapusan
    if (jadwal && jadwal.status_verifikasi === true) {
        return res.status(403).json({
            success: false,
            message: 'Gagal! Jadwal yang sudah diverifikasi (ACC) tidak dapat dibatalkan.'
        });
    }

    // 3. Jika belum di-ACC, baru jalankan fungsi hapus
    await deleteJadwalByNPM(npm); 
    
    return res.status(200).json({
      success: true,
      message: 'Jadwal berhasil dibatalkan.'
    });
  } catch (err) {
    console.error('❌ Gagal Hapus Jadwal:', err.message);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

module.exports = { 
    formatDateInput, 
    getIsiJadwal, 
    postIsiJadwal, 
    hapusJadwal 
};