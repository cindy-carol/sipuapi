// controllers/mahasiswa/dashboardController.js
const { Mahasiswa } = require('../../models/mahasiswaModel');
const { Status } = require('../../models/statusModel');

/**
 * Menampilkan Halaman Dashboard Mahasiswa
 * Menggunakan logika Waterfall untuk menentukan status pendaftaran secara realtime.
 */
const showDashboard = async (req, res) => {
  try {
    const npm = req.session.user?.npm;
    if (!npm) return res.status(401).send('Sesi tidak valid');

    // ============================================================
    // 🔹 1. AMBIL DATA SECARA PARALEL (OPTIMIZED)
    // ============================================================
    const [mhs, berkas, jadwalList, statusData, infoList, suratData] = await Promise.all([
      Mahasiswa.getMahasiswaByNPM(npm),
      Mahasiswa.getStatusBerkasByNPM(npm),
      Mahasiswa.getJadwalUjianByNPM(npm), // Mengandung data jadwal & daftar_ujian
      Status.getStatusMahasiswaByNPM(npm),
      Mahasiswa.getAllRincian(),
      Mahasiswa.getSuratByNPM(npm) // Data surat undangan
    ]);

    if (!mhs) return res.status(404).send('Data mahasiswa tidak ditemukan');

    // ============================================================
    // 🔹 2. LOGIC PENENTUAN STATUS OVERALL (WATERFALL)
    // ============================================================
    let statusOverall = 'Belum Mendaftar';
    let badge = { color: 'bg-secondary', text: 'text-light', icon: 'bi-circle' };

    // A. Cek Kelengkapan Berkas (Code: 3=Diterima, 2=Ditolak, 1=Menunggu, 0=Kosong)
    const rpl = berkas?.rpl || 0;
    const art = berkas?.artikel || 0;
    const as1 = berkas?.kartu_asistensi_1 || 0;

    const docsWajib = [rpl, art, as1];
    const isBerkasLengkap = docsWajib.every(code => code === 3);
    const isBerkasPending = docsWajib.some(code => code === 1);
    const isBerkasRejected = docsWajib.some(code => code === 2);

    // B. Cek Data Jadwal
    const jadwal = jadwalList ? jadwalList[0] : null;
    const isJadwalFilled = !!jadwal;
    const isJadwalVerified = jadwal?.status_verifikasi === true;
    const isJadwalRevisi = jadwal?.status_verifikasi === false && jadwal?.is_edited === true;

    // C. Cek Penguji & Surat
    const hasPenguji = jadwal?.daftar_ujian_id != null;
    const hasSurat = !!suratData;

    // --- LOGIKA WATERFALL STATUS ---
    if (statusData?.status === 'Selesai' || statusData?.status === 'Lulus') {
      statusOverall = 'Selesai';
      badge = { color: 'bg-success', text: 'text-white', icon: 'bi-check-circle-fill' };

    } else if (isBerkasRejected) {
      statusOverall = 'Perbaiki Berkas';
      badge = { color: 'bg-danger', text: 'text-white', icon: 'bi-exclamation-triangle-fill' };

    } else if (isBerkasPending) {
      statusOverall = 'Menunggu Verifikasi Berkas';
      badge = { color: 'bg-warning', text: 'text-dark', icon: 'bi-hourglass-split' };

    } else if (!isBerkasLengkap) {
      statusOverall = 'Lengkapi Berkas';
      badge = { color: 'bg-secondary', text: 'text-white', icon: 'bi-cloud-upload' };

    } else if (!isJadwalFilled) {
      statusOverall = 'Silakan Isi Jadwal';
      badge = { color: 'bg-primary', text: 'text-white', icon: 'bi-calendar-plus' };

    } else if (!isJadwalVerified) {
      if (isJadwalRevisi) {
        statusOverall = 'Jadwal Direvisi, Menunggu Verifikasi';
        badge = { color: 'bg-warning', text: 'text-dark', icon: 'bi-pencil-square' };
      } else {
        statusOverall = 'Menunggu Verifikasi Jadwal';
        badge = { color: 'bg-warning', text: 'text-dark', icon: 'bi-calendar-check' };
      }

    } else if (!hasPenguji) {
      statusOverall = 'Menunggu Penetapan Penguji';
      badge = { color: 'bg-info', text: 'text-dark', icon: 'bi-person-badge' };

    } else if (!hasSurat) {
      statusOverall = 'Menunggu Surat Undangan';
      badge = { color: 'bg-dark', text: 'text-white', icon: 'bi-envelope-paper' };

    } else {
      statusOverall = 'Siap Ujian';
      badge = { color: 'bg-success', text: 'text-white', icon: 'bi-play-circle-fill' };
    }

    // ===============================
    // 🔹 3. MAPPING STATUS BERKAS (DETAIL)
    // ===============================
    const mapStatusUI = (code) => {
      switch (code) {
        case 3: return { label: "Diterima", bg: "bg-success", text: "text-light", icon: "bi-check-circle" };
        case 2: return { label: "Ditolak", bg: "bg-danger", text: "text-light", icon: "bi-x-circle" };
        case 1: return { label: "Menunggu", bg: "bg-warning", text: "text-dark", icon: "bi-hourglass-split" };
        default: return { label: "Belum Ada", bg: "bg-secondary", text: "text-dark", icon: "bi-dash-circle" };
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
    // 🔹 4. FORMAT DATA JADWAL
    // ===============================
    const jadwalUjian = {
      tempat: jadwal?.tempat || '-',
      tanggal: jadwal?.tanggal
        ? new Date(jadwal.tanggal).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        : null,
      waktu: jadwal?.jam_mulai && jadwal?.jam_selesai
        ? `${jadwal.jam_mulai.substring(0, 5)} – ${jadwal.jam_selesai.substring(0, 5)}`
        : null,
      pelaksanaan: jadwal?.pelaksanaan || null,
      status_verifikasi: jadwal?.status_verifikasi,
      is_edited: jadwal?.is_edited
    };

    // ===============================
    // 🔹 5. INFORMASI & PERSYARATAN
    // ===============================
    const mode = jadwalUjian.pelaksanaan?.toLowerCase();

    // Cari info berdasarkan kriteria judul
    const infoDaftar = infoList.find(i => i.judul.toLowerCase().includes('pendaftaran')) || { keterangan: 'Info pendaftaran belum tersedia.' };
    
    let infoBawaan = { keterangan: '<span class="text-muted fst-italic">Pilih jadwal ujian terlebih dahulu untuk melihat syarat bawaan.</span>' };
    if (mode === 'online') {
      infoBawaan = infoList.find(i => i.judul.toLowerCase().includes('online')) || { keterangan: 'Syarat ujian online belum tersedia.' };
    } else if (mode === 'offline') {
      infoBawaan = infoList.find(i => i.judul.toLowerCase().includes('offline')) || { keterangan: 'Syarat ujian offline belum tersedia.' };
    }

    const syaratPendaftaran = `<div style="white-space: pre-wrap; line-height: 1.6;">${infoDaftar.keterangan}</div>`;
    const syaratBawa = `<div style="white-space: pre-wrap; line-height: 1.6;">${infoBawaan.keterangan}</div>`;

    // ===============================
    // 🔹 6. RENDER KE VIEW
    // ===============================
    res.render('mahasiswa/dashboard', {
      title: 'Dashboard Mahasiswa',
      currentPage: 'dashboard',
      role: 'Mahasiswa',

      // Data Identitas
      nama: mhs.nama,
      npm: mhs.npm,
      thajaran: `${mhs.nama_tahun} ${mhs.semester}`,
      dosbing1: mhs.dosbing1,
      dosbing2: mhs.dosbing2,

      // State Dashboard
      statusOverall,
      badge,
      statusBerkas,

      // Jadwal & Dokumen
      jadwalUjian,
      pathSurat: suratData?.path_file || null,

      // Konten Informasi
      syaratPendaftaran,
      syaratBawa
    });

  } catch (err) {
    console.error('❌ ERROR showDashboard Mahasiswa:', err);
    res.status(500).send('Gagal memuat dashboard mahasiswa');
  }
};

module.exports = { showDashboard };