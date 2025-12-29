// controllers/mahasiswa/dashboardController.js
const { Mahasiswa } = require('../../models/mahasiswaModel.js');
const { Status } = require('../../models/statusModel.js');

const showDashboard = async (req, res) => {
  try {
    const npm = req.session.user?.npm;
    if (!npm) return res.status(401).send('Sesi tidak valid');

    // ============================================================
    // 🔹 1. AMBIL DATA SECARA PARALEL
    // ============================================================
    const [mhs, berkas, jadwalList, statusData, infoList, suratData] = await Promise.all([
      Mahasiswa.getMahasiswaByNPM(npm),
      Mahasiswa.getStatusBerkasByNPM(npm),
      Mahasiswa.getJadwalUjianByNPM(npm),      // Mengandung data jadwal & daftar_ujian
      Status.getStatusMahasiswaByNPM(npm),      
      Mahasiswa.getAllRincian(),
      Mahasiswa.getSuratByNPM(npm)              // Data surat undangan
    ]);

    if (!mhs) return res.status(404).send('Data mahasiswa tidak ditemukan');

    // ============================================================
    // 🔹 2. LOGIC PENENTUAN STATUS OVERALL (WATERFALL)
    // ============================================================
    let statusOverall = 'Belum Mendaftar';
    // Default badge (Abu-abu)
    let badge = { color: 'bg-secondary', text: 'text-light', icon: 'bi-circle' };

    // A. Cek Kelengkapan Berkas (RPL, Artikel, Asistensi 1 wajib)
    // Code: 3=Diterima, 2=Ditolak, 1=Menunggu, 0=Belum Ada
    const rpl = berkas?.rpl || 0;
    const art = berkas?.artikel || 0;
    const as1 = berkas?.kartu_asistensi_1 || 0;
    
    const docsWajib = [rpl, art, as1];
    const isBerkasLengkap = docsWajib.every(code => code === 3); 
    const isBerkasPending = docsWajib.some(code => code === 1);  
    const isBerkasRejected = docsWajib.some(code => code === 2); 

    // B. Cek Data Jadwal
    const jadwal = jadwalList[0]; // Ambil jadwal terbaru
    const isJadwalFilled = !!jadwal; // Apakah sudah isi form?
    const isJadwalVerified = jadwal?.status_verifikasi === true; // Apakah sudah di-ACC?
    
    // Cek apakah perlu revisi jadwal (Ditolak/Edit)
    const isJadwalRevisi = jadwal?.status_verifikasi === false && jadwal?.is_edited === true;

    // C. Cek Penguji (Dari tabel daftar_ujian yang di-join di model jadwal)
    // Pastikan model getJadwalUjianByNPM melakukan JOIN ke daftar_ujian
    const hasPenguji = jadwal?.daftar_ujian_id != null; 

    // D. Cek Surat
    const hasSurat = !!suratData;

    // --- LOGIKA UTAMA (URUTAN PENGECEKAN) ---
    
    // 1. Cek Status Final (Lulus/Selesai)
    if (statusData?.status === 'Selesai' || statusData?.status === 'Lulus') {
        statusOverall = 'Selesai';
        badge = { color: 'bg-success', text: 'text-white', icon: 'bi-check-circle-fill' };
    
    // 2. Cek Berkas Bermasalah
    } else if (isBerkasRejected) {
        statusOverall = 'Perbaiki Berkas';
        badge = { color: 'bg-danger', text: 'text-white', icon: 'bi-exclamation-triangle-fill' };

    // 3. Cek Berkas Sedang Diverifikasi
    } else if (isBerkasPending) {
        statusOverall = 'Menunggu Verifikasi Berkas';
        badge = { color: 'bg-warning', text: 'text-dark', icon: 'bi-hourglass-split' };

    // 4. Cek Kelengkapan Berkas (Kalau belum lengkap, suruh lengkapi)
    } else if (!isBerkasLengkap) {
        statusOverall = 'Lengkapi Berkas';
        badge = { color: 'bg-secondary', text: 'text-white', icon: 'bi-cloud-upload' };

    // 5. Berkas OK -> Cek Apakah Sudah Isi Jadwal
    } else if (!isJadwalFilled) {
        statusOverall = 'Silakan Isi Jadwal';
        badge = { color: 'bg-primary', text: 'text-white', icon: 'bi-calendar-plus' };

    // 6. Jadwal Ada -> Cek Verifikasi Jadwal
// 6. Jadwal Ada -> Cek Verifikasi Jadwal
} else if (!isJadwalVerified) {
    // 🔥 Cek apakah ini hasil editan yang BELUM di-verifikasi ulang
    if (isJadwalRevisi && !isJadwalVerified) {
         statusOverall = 'Jadwal Telah Direvisi, Menunggu Verifikasi Ulang'; 
         badge = { color: 'bg-warning', text: 'text-dark', icon: 'bi-pencil-square' };
    } else {
         statusOverall = 'Menunggu Verifikasi Jadwal';
         badge = { color: 'bg-warning', text: 'text-dark', icon: 'bi-calendar-check' };
    }


    // 7. Jadwal Verified -> Cek Penguji (Tugas Kaprodi)
    } else if (!hasPenguji) {
        statusOverall = 'Menunggu Penetapan Penguji';
        badge = { color: 'bg-info', text: 'text-dark', icon: 'bi-person-badge' };

    // 8. Penguji Ada -> Cek Surat (Tugas Admin)
    } else if (!hasSurat) {
        statusOverall = 'Menunggu Penguji dan Surat Undangan';
        // Pakai warna gelap/ungu biar beda
        badge = { color: 'bg-dark', text: 'text-white', icon: 'bi-envelope-paper' }; 

    // 9. Surat Ada -> Siap Ujian
    } else {
        statusOverall = 'Siap Ujian';
        badge = { color: 'bg-success', text: 'text-white', icon: 'bi-play-circle-fill' };
    }

    // ===============================
    // 🔹 3. STATUS BERKAS UI (DETAIL)
    // ===============================
    const mapStatusUI = (code) => {
      switch (code) {
        case 3: return { label: "Diterima", bg: "bg-success", text: "text-light", icon: "bi-check-circle", title: "Diterima" };
        case 2: return { label: "Ditolak", bg: "bg-danger", text: "text-light", icon: "bi-x-circle", title: "Ditolak" };
        case 1: return { label: "Menunggu", bg: "bg-warning", text: "text-dark", icon: "bi-hourglass-split", title: "Menunggu" };
        default: return { label: "Belum Ada", bg: "bg-secondary", text: "text-dark", icon: "bi-dash-circle", title: "Kosong" };
      }
    };

    const statusBerkas = {
      dokumen_rpl: mapStatusUI(berkas?.rpl),
      draft_artikel: mapStatusUI(berkas?.artikel),
      asistensi_1: mapStatusUI(berkas?.kartu_asistensi_1),
      asistensi_2: mapStatusUI(berkas?.kartu_asistensi_2),
      asistensi_3: mapStatusUI(berkas?.kartu_asistensi_3)
    };

    // ===============================
    // 🔹 4. DATA JADWAL & PELAKSANAAN
    // ===============================
    const jadwalUjian = {
      tempat: jadwalList[0]?.tempat || '-',
      tanggal: jadwalList[0]?.tanggal 
        ? jadwalList[0].tanggal.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) 
        : null,
      waktu: jadwalList[0]?.jam_mulai && jadwalList[0]?.jam_selesai
        ? `${jadwalList[0].jam_mulai.substring(0,5)} – ${jadwalList[0].jam_selesai.substring(0,5)}`
        : null,
      pelaksanaan: jadwalList[0]?.pelaksanaan || null,
      // Tambahan status untuk UI Card Jadwal
      status_verifikasi: jadwalList[0]?.status_verifikasi,
      is_edited: jadwalList[0]?.is_edited
    };

    // ===============================
    // 🔹 5. LOGIC INFORMASI & SYARAT
    // ===============================
    const pelaksanaan = jadwalUjian.pelaksanaan ? jadwalUjian.pelaksanaan.toLowerCase() : null;

    // Info Pendaftaran
    const infoDaftar = infoList.find(i => i.judul.toLowerCase().includes('pendaftaran')) 
                       || { keterangan: 'Belum ada informasi pendaftaran.' };

    // Info Bawaan (Berdasarkan Online/Offline)
    let infoBawaan = null;
    if (pelaksanaan === 'online') {
        infoBawaan = infoList.find(i => i.judul.toLowerCase().includes('online'));
    } else if (pelaksanaan === 'offline') {
        infoBawaan = infoList.find(i => i.judul.toLowerCase().includes('offline'));
    } else {
        infoBawaan = { keterangan: '<span class="text-muted fst-italic">Silakan pilih jadwal ujian terlebih dahulu untuk melihat persyaratan yang wajib dibawa.</span>' };
    }

    if (!infoBawaan || !infoBawaan.keterangan) {
         if (pelaksanaan) infoBawaan = { keterangan: 'Informasi persyaratan belum tersedia.' };
    }

    const syaratPendaftaran = `<div style="white-space: pre-wrap; line-height: 1.6;">${infoDaftar.keterangan}</div>`;
    const syaratBawa = `<div style="white-space: pre-wrap; line-height: 1.6;">${infoBawaan.keterangan}</div>`;

    // Redirect jika sudah lulus (opsional)
    if (statusOverall === 'Selesai') {
      return res.redirect('/selesai');
    }

    // ===============================
    // 🔹 6. RENDER VIEW
    // ===============================
    res.render('mahasiswa/dashboard', {
      title: 'Dashboard Mahasiswa',
      currentPage: 'dashboard',
      role: 'Mahasiswa',

      // Data Diri
      nama: mhs.nama,
      npm: mhs.npm,
      thajaran: `${mhs.nama_tahun} ${mhs.semester}`,
      dosbing1: mhs.dosbing1,
      dosbing2: mhs.dosbing2,

      // Status Dashboard Utama
      statusOverall,
      badge,
      statusBerkas,
      
      // Data Jadwal & Surat
      jadwalUjian,
      pathSurat: suratData ? suratData.path_file : null,

      // Syarat-syarat
      syaratPendaftaran,
      syaratBawa
    });

  } catch (err) {
    console.error('❌ ERROR showDashboard Mahasiswa:', err);
    res.status(500).send('Gagal menampilkan dashboard mahasiswa');
  }  
};

module.exports = { showDashboard };