// controllers/mahasiswa/isiJadwalController
const { Mahasiswa } = require('../../models/mahasiswaModel');
const { getJadwalUjian, saveJadwalMahasiswa, deleteJadwalByNPM, getJadwalByNPM } = require('../../models/jadwalModel');

// Helper Format Tanggal
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

    // Cek Status Berkas (Satpam Awal)
    const statusBerkas = await Mahasiswa.getStatusBerkasByNPM(npm);
    if (statusBerkas.rpl !== 3 || statusBerkas.artikel !== 3 || statusBerkas.kartu_asistensi_1 !== 3) {
        if (req.flash) req.flash('error', '🚫 Akses Ditolak! Lengkapi berkas RPL, Artikel, & Asistensi dulu.');
        return res.redirect('/mahasiswa/dashboard');
    }

    const mhs = await Mahasiswa.getMahasiswaByNPM(npm);
    const allJadwal = await getJadwalUjian(); // Ambil semua jadwal buat kalender

    // Mapping Data untuk FullCalendar
const events = allJadwal.map(j => {
  const isMyEvent = j.npm === npm;
  const dateStr = formatDateInput(j.tanggal); 
  const jamStart = (j.jam_mulai || '00:00:00').substring(0, 5);
  const jamEnd = (j.jam_selesai || '00:00:00').substring(0, 5);

  let warna, titleLabel, textColor;

  // =========================================================
  // LOGIKA PRIORITAS WARNA (VERIFIKASI-FIRST)
  // =========================================================
  
  if (isMyEvent) {
    // 1. CEK STATUS VERIFIKASI JADWAL SAYA
    if (j.status_verifikasi === true) {
      // HIJAU: Sudah Oke / Terverifikasi
      titleLabel = "Jadwal Anda (Disetujui)";
      warna = '#198754'; 
      textColor = '#ffffff';
    } else {
      // KUNING: Baru isi / Baru Edit (Reset) / Belum di-oper
      titleLabel = "Jadwal Anda (Menunggu)";
      warna = '#ffc107'; 
      textColor = '#000000';
    }
  } else {
    // 2. JADWAL ORANG LAIN (Legenda: Jadwal Terisi)
    // Pakai warna gelap/abu-abu agar mahasiswa fokus ke jadwal sendiri
    if (j.pelaksanaan === 'offline') {
      titleLabel = "OFFLINE"; 
      warna = '#343a40'; // Hitam/Gelap
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
      // Status 'confirmed' hanya jika status_verifikasi TRUE
      status: j.status_verifikasi === true ? 'confirmed' : 'softbooked',
      owner: j.npm, 
      isMine: isMyEvent,
      // Data untuk validasi bentrok di frontend
      dosenTerlibat: [j.dosbing1_id, j.dosbing2_id, j.dosen_penguji_id].filter(id => id != null)
    }
  };
});

    const myDosenIds = [mhs.dosbing1_id, mhs.dosbing2_id].filter(id => id != null);
    
    // Fallback ambil jadwal sendiri
    let myJadwal = allJadwal.find(j => j.npm === npm);
    if (!myJadwal) {
        const myJadwalList = await getJadwalByNPM(npm);
        myJadwal = myJadwalList[0] || {};
    }

    res.render('mahasiswa/isi-jadwal', {
      title: 'Isi Jadwal',
      currentPage: 'isi-jadwal',
      role: 'mahasiswa',
      nama: mhs.nama,
      npm: mhs.npm,
      thajaran: `${mhs.nama_tahun} ${mhs.semester}`,
      dosbing1: mhs.dosbing1,
      dosbing2: mhs.dosbing2,
      myDosenIds: myDosenIds, 
      tempat: myJadwal.tempat || '',
      
      // 🔥 PERBAIKAN DI SINI (Variable dikirim sesuai nama di EJS)
      tanggal: formatDateInput(myJadwal.tanggal),         // Dulu: tanggalUjian
      jamMulai: myJadwal.jam_mulai ? myJadwal.jam_mulai.substring(0, 5) : '', // Dulu: waktuUjian
      
      pelaksanaan: myJadwal.pelaksanaan || '',
      events: JSON.stringify(events) 
    });

  } catch (err) {
    console.error('❌ Error getIsiJadwal:', err);
    res.status(500).send('Gagal menampilkan form jadwal');
  }
};

// ==========================================
// 2️⃣ POST: PROSES SIMPAN JADWAL (AJAX JSON)
// ==========================================
const postIsiJadwal = async (req, res) => {
  // 🔥 PERBAIKAN DI SINI (Ambil nama variabel baru dari Frontend)
  // Frontend mengirim: { tanggal, jamMulai, jamSelesai, pelaksanaan, tempat }
  const { tanggal, jamMulai, jamSelesai, pelaksanaan, tempat } = req.body;
  const npm = req.session.user.npm;

  try {
    // Karena Frontend JS kita sudah hitung jamSelesai, kita pakai langsung kalau ada.
    // Tapi buat jaga-jaga, kalau jamSelesai kosong, kita hitung manual di sini.
    let finalJamSelesai = jamSelesai;
    
    if (!finalJamSelesai) {
        const [h, m] = jamMulai.split(':').map(Number);
        finalJamSelesai = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    
    // Panggil Model (Logic Satpam Sapu Jagat)
    // Gunakan variabel 'tanggal' dan 'jamMulai' yang baru
    await saveJadwalMahasiswa(npm, tanggal, jamMulai, finalJamSelesai, pelaksanaan, tempat);
    
    // ✅ SUKSES: Balikin JSON 200 OK
    return res.status(200).json({
        success: true,
        message: 'Jadwal berhasil disimpan! Menunggu verifikasi admin.'
    });

  } catch (err) {
    console.error('❌ Gagal Simpan:', err.message);

    // ❌ GAGAL: Balikin JSON 400 Bad Request + Pesan Error Satpam
    return res.status(400).json({
        success: false,
        message: err.message 
    });
  }
};

// ==========================================
// 3️⃣ HAPUS JADWAL
// ==========================================
// isiJadwalController.js

const hapusJadwal = async (req, res) => {
  try {
    const npm = req.session.user.npm;
    await deleteJadwalByNPM(npm); //
    
    // Kirim respon sukses dalam format JSON agar bisa ditangkap oleh SweetAlert di frontend
    return res.status(200).json({
      success: true,
      message: 'Jadwal berhasil dibatalkan.'
    });
  } catch (err) {
    console.error('❌ Error hapus:', err);
    return res.status(500).json({
      success: false,
      message: 'Gagal menghapus jadwal.'
    });
  }
};

exports.showIsiJadwal = async (req, res) => {
  try {
    const npm = req.session.user.npm;
    // 1. Ambil status berkas terbaru
    const berkas = await Mahasiswa.getStatusBerkasByNPM(npm); //

    // 2. Cek kelengkapan (Logic sama persis kayak dashboardController)
    const rpl = berkas?.rpl || 0;
    const art = berkas?.artikel || 0;
    const as1 = berkas?.kartu_asistensi_1 || 0;
    
    // Syarat Lolos: Semua dokumen wajib harus status code 3 (Diterima)
    const docsWajib = [rpl, art, as1];
    const isLolosVerifikasi = docsWajib.every(code => code === 3);

    // 3. TENDANG KALAU BELUM LOLOS 🦶
    if (!isLolosVerifikasi) {
        // Flash message biar user ngeh kenapa mental
        req.flash('error', 'Akses Ditolak! Berkas Anda belum lengkap atau belum disetujui Admin.');
        return res.redirect('/mahasiswa/dashboard');
    }
  } catch (error) {
    console.error(error);
    res.redirect('/mahasiswa/dashboard');
  }
};

module.exports = { formatDateInput, getIsiJadwal, postIsiJadwal, hapusJadwal };