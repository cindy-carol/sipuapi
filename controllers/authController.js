const pool = require('../config/db');
const bcrypt = require('bcrypt');
const { TahunAjaran } = require('../models/tahunAjaranModel');
const Penguji = require('../models/pengujiModel');
const { Dashboard: AdminDashboard } = require('../models/adminDashboardModel');
const { Dashboard: KaprodiDashboard } = require('../models/kaprodiDashboardModel');

// ============================================================================
// 1. LOGIN
// ============================================================================
const loginAdminKaprodi = async (req, res) => {
  const { username, password } = req.body;
  try {
    // 1. Ambil data user dari DB
    const result = await pool.query(
      'SELECT * FROM akun WHERE username = $1 AND role = ANY($2)',
      [username, ['admin', 'kaprodi']]
    );

    const user = result.rows[0];

    // Jika user tidak ditemukan
    if (!user) {
      return res.render('login-admin-kaprodi', { title: 'Login Admin & Kaprodi', error: 'Username atau password salah' });
    }

    // Cek Status Aktif
    if (user.status_aktif === false) {
         return res.render('login-admin-kaprodi', { title: 'Login Admin & Kaprodi', error: 'AKUN DINONAKTIFKAN! Hubungi Super Admin.' });
    }

    // 2. Cek Password
    let isMatch = false;
    if (user.password.startsWith('$2b$')) {
        isMatch = await bcrypt.compare(password, user.password);
    } else {
        isMatch = (user.password === password);
    }

    if (!isMatch) {
      return res.render('login-admin-kaprodi', { title: 'Login Admin & Kaprodi', error: 'Username atau password salah' });
    }

    // 3. Simpan Sesi
    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      nama: user.nama
    };

    // 4. Redirect
    if (user.role === 'admin') {
      return res.redirect('/admin/dashboard');
    } else if (user.role === 'kaprodi') {
      return res.redirect('/kaprodi/dashboard');
    } else {
      return res.render('login-admin-kaprodi', { title: 'Login Admin & Kaprodi', error: 'Role tidak dikenal' });
    }

  } catch (err) {
    console.error('Login error:', err);
    res.render('login-admin-kaprodi', { title: 'Login Admin & Kaprodi', error: 'Terjadi kesalahan server' });
  }
};


// ============================================================================
// 2. DASHBOARD ADMIN (PERBAIKAN JUDUL TAHUN & LIST SCROLL)
// ============================================================================
// ============================================================================
// 2. DASHBOARD ADMIN
// ============================================================================
const showDashboardAdmin = async (req, res) => {
  // 1. Cek Sesi Login
  if (!req.session.user) return res.redirect('/login-admin-kaprodi');

  try {
    // 2. Ambil List Tahun Ajaran (untuk Dropdown)
    const tahunAjarList = await TahunAjaran.getListForSelect();
    
    // 3. Tentukan Tahun Aktif (Dari URL atau Default Tahun Terbaru)
    let selectedTahunId = req.query.tahun_ajaran || (tahunAjarList.length > 0 ? tahunAjarList[0].id : null);

    // 4. Tentukan Judul Tahun (untuk Tampilan di Kartu Biru Atas)
    let judulTahun = "Semua Tahun";
    if (selectedTahunId) {
       const selectedTahun = tahunAjarList.find(t => t.id == selectedTahunId);
       if (selectedTahun) judulTahun = selectedTahun.label;
    }

    // 5. Ambil Data Statistik Utama (Angka Besar)
    const ringkasan = await AdminDashboard.getRingkasanMahasiswa(selectedTahunId);
    
    // 6. Ambil Data Kartu Warna-Warni (Upload Berkas, dll)
    // Pastikan Model getStatistikRingkas sudah ada property 'key'
    const statistikRingkas = await AdminDashboard.getStatistikRingkas(selectedTahunId);
    
    // 7. 🔥 PENTING: Ambil Breakdown Per Tahun (Untuk List di Bawah Angka) 🔥
    const breakdownTahun = await AdminDashboard.getStatistikLengkapPerTahun();

    // 8. Ambil Data Informasi/Pengumuman (Editable Cards)
    const dataRincian = await AdminDashboard.getAllRincian();
    const editableCards = dataRincian.map(item => ({
        id: item.id,
        title: item.judul || 'Tanpa Judul',
        content: item.keterangan || '-'
    }));

    // 9. Kirim Semua Data ke View (dashboard.ejs)
    res.render('admin/dashboard', {
      title: 'Dashboard Admin',
      currentPage: 'dashboard',
      user: req.session.user,
      
      // Data Dropdown & Judul
      tahunAjarList,
      selectedTahunId,
      judulTahun,
      
      // Data List Rincian (Ini yang bikin list di bawah angka muncul)
      breakdownTahun, 
      
      // Data Statistik Utama
      jumlahMahasiswa: ringkasan.jumlahMahasiswa || 0,
      belumDaftar: ringkasan.belumDaftar || 0,
      menungguUjian: ringkasan.menungguUjian || 0,
      sudahUjian: ringkasan.sudahUjian || 0,
      
      // Data Kartu Warna
      statistikRingkas,
      
      // Data Pengumuman
      editableCards,
      
      // Config Tambahan
      showBarChart: true, 
      showPieChart: true,
      error: '',
      dbDebug: {
        name: 'Connected',
        count: dataRincian.length
      }
    });

  } catch (err) {
    console.error('❌ Error load dashboard Admin:', err);
    res.status(500).send('Gagal memuat dashboard Admin: ' + err.message);
  }
};


// ============================================================================
// 3. DASHBOARD KAPRODI
// ============================================================================
// ============================================================================
// 3. DASHBOARD KAPRODI (FIX ANTREAN UNIVERSAL)
// ============================================================================
const showDashboardKaprodi = async (req, res) => {
  if (!req.session.user) return res.redirect('/login-admin-kaprodi');

  try {
    const tahunAjarList = await TahunAjaran.getListForSelect();
    let selectedTahunId = req.query.tahun_ajaran || req.selectedTahunId || (tahunAjarList[0]?.id);

    // Data-data yang MEMANG harus difilter per tahun (Angka Statistik)
    const ringkasan = await KaprodiDashboard.getRingkasanMahasiswa(selectedTahunId);
    const statistikRingkas = await KaprodiDashboard.getStatistikRingkas(selectedTahunId);
    const breakdownTahun = await AdminDashboard.getStatistikLengkapPerTahun();
    const rekapPerDosen = await KaprodiDashboard.getRekapPerDosen(selectedTahunId);

    // 🔥 PERBAIKAN UTAMA: Panggil fungsi dari PengujiModel tanpa parameter tahun
    // Ini yang bikin Diana Yunita tetap muncul di semua tahun
    const antreanPenguji = await Penguji.getMahasiswaBelumPenguji();
    const antreanLimit = antreanPenguji.slice(0, 5); 
    const totalAntrean = antreanPenguji.length;

    res.render('kaprodi/dashboard', {
      title: 'Dashboard Kaprodi',
      currentPage: 'dashboard',
      user: req.session.user,
      tahunAjarList,
      selectedTahunId,
      
      // Angka Statistik (Tetap ikut filter tahun)
      jumlahMahasiswa: ringkasan.jumlahMahasiswa || 0,
      belumDaftar: ringkasan.belumDaftar || 0,
      menungguUjian: ringkasan.menungguUjian || 0,
      sudahUjian: ringkasan.sudahUjian || 0,
      statistikRingkas,
      
      // Data Antrean (Sekarang pakai yang Universal)
      antreanPenguji, 
      mahasiswaBelum: antreanLimit,
      totalAntrean: totalAntrean,

      breakdownTahun: breakdownTahun,
      rekapPerDosen, 
      showBarChart: true, 
      showPieChart: true,
      error: ''
    });
  } catch (err) {
    console.error('Error load dashboard Kaprodi:', err);
    res.status(500).send('Gagal memuat dashboard Kaprodi');
  }
};

// ============================================================================
// 4. LOGOUT
// ============================================================================
const logout = (req, res) => {
  let destination = '/'; 

  if (req.session && req.session.user && req.session.user.role) {
    const role = req.session.user.role.toLowerCase();
    if (role === 'mahasiswa') {
      destination = '/login';
    }
  }

  req.session.destroy(err => {
    if (err) console.error('Error destroying session:', err);
    res.clearCookie('connect.sid');
    res.redirect(destination);
  });
};

module.exports = {
  loginAdminKaprodi,
  showDashboardAdmin,
  showDashboardKaprodi,
  logout
};