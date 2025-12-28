const pool = require('@config/db.js');

// 🔥 UPDATE: Import juga getJadwalDosen dari model yang bener
const { 
  getMahasiswaByNPM, 
  getAllDosen, 
  assignPenguji, 
  getJadwalDosen 
} = require('@models/pengujiModel.js'); // Pastikan path ini sesuai nama file model lo

const renderPilihPenguji = async (req, res) => {
  try {
    const npm = req.params.npm;
    const mahasiswa = await getMahasiswaByNPM(npm);

    if (!mahasiswa) {
      return res.status(404).send('Mahasiswa tidak ditemukan');
    }

    // Ambil semua dosen
    let daftarDosen = await getAllDosen();

    // Filter dosen yang sudah jadi pembimbing (Dosbing gaboleh jadi Penguji)
    daftarDosen = daftarDosen.filter(d => 
      d.id !== mahasiswa.dosbing1_id && 
      d.id !== mahasiswa.dosbing2_id
    );

    // ======================================================
    // 🔥 FILTER DOSEN SIBUK (BENTROK JADWAL)
    // ======================================================
    if (mahasiswa.tanggal && mahasiswa.jam_mulai && mahasiswa.jam_selesai) {
      
      // Panggil detektif buat nyari siapa yang sibuk
      const dosenSibukIds = await getJadwalDosen(
        mahasiswa.tanggal, 
        mahasiswa.jam_mulai, 
        mahasiswa.jam_selesai,
        mahasiswa.id // ID mahasiswa ini (exclude diri sendiri)
      );

      // Log debugging (Cek terminal)
      // console.log(`🕒 Jadwal Mhs: ${mahasiswa.jam_mulai} - ${mahasiswa.jam_selesai}`);
      // console.log('⛔ ID Dosen Sibuk:', dosenSibukIds);

      // Buang dosen yang ID-nya ada di daftar sibuk
      daftarDosen = daftarDosen.filter(d => !dosenSibukIds.includes(d.id));
    }

    const tanggal = mahasiswa.tanggal 
      ? new Date(mahasiswa.tanggal).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) 
      : '-';

    const waktu = mahasiswa.jam_mulai && mahasiswa.jam_selesai 
      ? `${mahasiswa.jam_mulai.substring(0,5)} - ${mahasiswa.jam_selesai.substring(0,5)}` 
      : '-';

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
      daftarDosen
    });
  } catch (err) {
    console.error('Error renderPilihPenguji:', err);
    res.status(500).send('Gagal memuat data mahasiswa');
  }
};

const postPilihPenguji = async (req, res) => {
  try {
    const npm = req.params.npm;
    const { dosenIds } = req.body;
    
    // ============================================================
    // 🕵️‍♂️ BAGIAN AUDIT TRAIL & OTORISASI
    // ============================================================
    
    // 1. SIAPA YANG LOGIN? (DATA AUDIT / CCTV)
    // Ambil ID Akun dari session (bisa ID Admin atau ID Dosen)
    const editorId = req.session.user?.id; 

    // 2. SIAPA KAPRODINYA? (DATA BISNIS / SK)
    // Kita cari ID Dosen milik user yang sedang login (asumsi Kaprodi login sendiri)
    // Kalau Admin yang login, logic ini mungkin perlu disesuaikan (misal ambil Kaprodi aktif)
    const nipSession = req.session.user.username; 
    const resultKaprodi = await pool.query(`SELECT id FROM dosen WHERE nip_dosen = $1`, [nipSession]);
    
    // Fallback: Jika admin login, mungkin nipSession bukan NIP dosen.
    // Untuk sementara kita biarkan validasi ini, tapi di masa depan bisa di-bypass kalau role == 'admin'
    let kaprodiId = null;
    if (resultKaprodi.rows.length > 0) {
        kaprodiId = resultKaprodi.rows[0].id;
    } else {
        // Handle jika Admin yang login (Opsional: Ambil ID Kaprodi Default atau NULL)
        // console.warn("User login bukan dosen (mungkin Admin). Kolom kaprodi_id akan NULL.");
    }

    // ============================================================

    // Ambil info mahasiswa
    const mahasiswa = await getMahasiswaByNPM(npm);
    if (!mahasiswa) return res.status(404).send('Mahasiswa tidak ditemukan');

    // Filter dosen yang dipilih (biar gak milih dosbing sendiri)
    const daftarPengujiFiltered = Array.isArray(dosenIds) ? dosenIds : [dosenIds];
    const filtered = daftarPengujiFiltered.filter(dosenId =>
      parseInt(dosenId) !== mahasiswa.dosbing1_id && 
      parseInt(dosenId) !== mahasiswa.dosbing2_id
    );

    // 3. EKSEKUSI KE MODEL (Kirim 4 Parameter)
    // assignPenguji(npm, listDosen, ID_Pejabat, ID_User_Login)
    await assignPenguji(npm, filtered, kaprodiId, editorId); 

    res.redirect('/kaprodi/penetapan-penguji');
  } catch (err) {
    console.error('Error postPilihPenguji:', err);
    res.status(500).send('Gagal menyimpan penguji');
  }
};

module.exports = {
  renderPilihPenguji,
  postPilihPenguji
};