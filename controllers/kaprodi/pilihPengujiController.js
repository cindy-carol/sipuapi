// controllers/kaprodi/pilihPengujiController.js
const pool = require('../../config/db');

// 🔥 IMPORT MODEL: Mengambil logika bisnis untuk filter dosen dan penetapan
const { 
  getMahasiswaByNPM, 
  getAllDosen, 
  assignPenguji, 
  getJadwalDosen 
} = require('../../models/pengujiModel'); 

/**
 * ============================================================
 * 🔍 1. RENDER: HALAMAN PILIH PENGUJI (DENGAN FILTER BENTROK)
 * ============================================================
 */
const renderPilihPenguji = async (req, res) => {
  try {
    const npm = req.params.npm;
    const mahasiswa = await getMahasiswaByNPM(npm);

    if (!mahasiswa) {
      return res.status(404).send('Mahasiswa tidak ditemukan');
    }

    // A. Ambil semua dosen aktif
    let daftarDosen = await getAllDosen();

    // B. FILTER 1: Dosen pembimbing mahasiswa tersebut tidak boleh jadi penguji
    daftarDosen = daftarDosen.filter(d => 
      d.id !== mahasiswa.dosbing1_id && 
      d.id !== mahasiswa.dosbing2_id
    );

    // C. FILTER 2: DETEKSI BENTROK JADWAL (Dosen Sibuk)
    // Hanya berjalan jika mahasiswa sudah memiliki jadwal ujian yang pasti
    if (mahasiswa.tanggal && mahasiswa.jam_mulai && mahasiswa.jam_selesai) {
      
      // Mengambil daftar ID dosen yang sedang menguji/membimbing di jam yang sama
      const dosenSibukIds = await getJadwalDosen(
        mahasiswa.tanggal, 
        mahasiswa.jam_mulai, 
        mahasiswa.jam_selesai,
        mahasiswa.id // Exclude pencatatan jadwal mahasiswa ini sendiri
      );

      // Keluarkan dosen yang ID-nya masuk dalam daftar "Dosen Sibuk"
      daftarDosen = daftarDosen.filter(d => !dosenSibukIds.includes(d.id));
    }

    // D. Formatting untuk Tampilan View
    const tanggal = mahasiswa.tanggal 
      ? new Date(mahasiswa.tanggal).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) 
      : '-';

    const waktu = mahasiswa.jam_mulai && mahasiswa.jam_selesai 
      ? `${mahasiswa.jam_mulai.substring(0,5)} - ${mahasiswa.jam_selesai.substring(0,5)} WIB` 
      : '-';

    // Sembunyikan sidebar agar fokus pada pemilihan penguji (UI Clean)
    res.locals.hideSidebar = true;
    res.render('kaprodi/pilih-penguji', {
      title: 'Pilih Dosen Penguji',
      currentPage: 'pilih-penguji',
      role: 'Kaprodi',
      mahasiswa,
      mhs: mahasiswa,
      npm: mahasiswa.npm,
      dosen1: mahasiswa.dosbing1,
      dosen2: mahasiswa.dosbing2,
      tanggal,
      waktu,
      tempat: mahasiswa.tempat,
      pelaksanaan: mahasiswa.pelaksanaan,
      daftarDosen // Hanya mengirimkan dosen yang tersedia (tidak bentrok)
    });
  } catch (err) {
    console.error('❌ Error renderPilihPenguji:', err);
    res.status(500).send('Terjadi kesalahan saat memproses data ketersediaan dosen.');
  }
};

/**
 * ============================================================
 * 💾 2. POST: PROSES SIMPAN PENETAPAN PENGUJI
 * ============================================================
 */
const postPilihPenguji = async (req, res) => {
  try {
    const npm = req.params.npm;
    const { dosenIds } = req.body;
    
    // 1. DATA AUDIT: Mencatat siapa yang melakukan perubahan (Admin/Kaprodi)
    const editorId = req.session.user?.id; 

    // 2. DATA OTORISASI: Ambil ID Dosen Kaprodi dari username/NIP login
    const nipSession = req.session.user.username; 
    const resultKaprodi = await pool.query(`SELECT id FROM dosen WHERE nip_dosen = $1`, [nipSession]);
    
    let kaprodiId = null;
    if (resultKaprodi.rows.length > 0) {
        kaprodiId = resultKaprodi.rows[0].id;
    }

    // 3. Validasi & Filter Sisi Server (Mencegah Bypass Frontend)
    const mahasiswa = await getMahasiswaByNPM(npm);
    if (!mahasiswa) return res.status(404).send('Mahasiswa tidak ditemukan');

    const daftarPengujiFiltered = Array.isArray(dosenIds) ? dosenIds : [dosenIds];
    const filtered = daftarPengujiFiltered.filter(dosenId =>
      parseInt(dosenId) !== mahasiswa.dosbing1_id && 
      parseInt(dosenId) !== mahasiswa.dosbing2_id
    );

    // 4. EKSEKUSI: Simpan ke tabel daftar_ujian dan update status
    await assignPenguji(npm, filtered, kaprodiId, editorId); 

    res.redirect('/kaprodi/penetapan-penguji');
  } catch (err) {
    console.error('❌ Error postPilihPenguji:', err);
    res.status(500).send('Gagal menyimpan penetapan penguji.');
  }
};

module.exports = {
  renderPilihPenguji,
  postPilihPenguji
};