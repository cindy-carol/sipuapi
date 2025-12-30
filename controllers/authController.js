// controllers/authController.js
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const { TahunAjaran } = require('../models/tahunAjaranModel');
const Penguji = require('../models/pengujiModel');
const { Dashboard: AdminDashboard } = require('../models/adminDashboardModel');
const { Dashboard: KaprodiDashboard } = require('../models/kaprodiDashboardModel');

// ============================================================================
// 1. LOGIN (ADMIN & KAPRODI)
// ============================================================================
const loginAdminKaprodi = async (req, res) => {
  const { username, password } = req.body;
  try {
    // 1. Ambil data user dari DB berdasarkan role yang diizinkan
    const result = await pool.query(
      'SELECT id, username, password, role, nama, status_aktif FROM akun WHERE username = $1 AND role = ANY($2)',
      [username, ['admin', 'kaprodi']]
    );

    const user = result.rows[0];

    // Jika user tidak ditemukan
    if (!user) {
      return res.render('login-admin-kaprodi', { 
        title: 'Login Admin & Kaprodi', 
        error: 'Username atau password salah' 
      });
    }

    // Cek Status Aktif Akun
    if (user.status_aktif === false) {
      return res.render('login-admin-kaprodi', { 
        title: 'Login Admin & Kaprodi', 
        error: 'AKUN DINONAKTIFKAN! Hubungi Super Admin.' 
      });
    }

    // 2. Verifikasi Password (Hanya mendukung BCrypt untuk keamanan produksi)
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render('login-admin-kaprodi', { 
        title: 'Login Admin & Kaprodi', 
        error: 'Username atau password salah' 
      });
    }

    // 3. Simpan data pengguna ke Sesi
    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      nama: user.nama
    };

    // 4. Redirect berdasarkan Role
    if (user.role === 'admin') {
      return res.redirect('/admin/dashboard');
    } else if (user.role === 'kaprodi') {
      return res.redirect('/kaprodi/dashboard');
    } else {
      return res.render('login-admin-kaprodi', { 
        title: 'Login Admin & Kaprodi', 
        error: 'Role tidak dikenal' 
      });
    }

  } catch (err) {
    console.error('❌ Login error:', err);
    res.render('login-admin-kaprodi', { 
      title: 'Login Admin & Kaprodi', 
      error: 'Terjadi kesalahan sistem' 
    });
  }
};


// ============================================================================
// 2. DASHBOARD ADMIN
// ============================================================================
const showDashboardAdmin = async (req, res) => {
  if (!req.session.user) return res.redirect('/login-admin-kaprodi');

  try {
    // Ambil List Tahun Ajaran untuk Filter Dropdown
    const tahunAjarList = await TahunAjaran.getListForSelect();
    
    // Tentukan Tahun Aktif (Default: Tahun terbaru dari database)
    let selectedTahunId = req.query.tahun_ajaran || (tahunAjarList.length > 0 ? tahunAjarList[0].id : null);

    // Tentukan Label Tahun untuk Header UI
    let judulTahun = "Semua Tahun";
    if (selectedTahunId) {
       const selectedTahun = tahunAjarList.find(t => t.id == selectedTahunId);
       if (selectedTahun) judulTahun = selectedTahun.label;
    }

    // Ambil Data Statistik secara Paralel untuk efisiensi
    const [ringkasan, statistikRingkas, breakdownTahun, dataRincian] = await Promise.all([
        AdminDashboard.getRingkasanMahasiswa(selectedTahunId),
        AdminDashboard.getStatistikRingkas(selectedTahunId),
        AdminDashboard.getStatistikLengkapPerTahun(),
        AdminDashboard.getAllRincian()
    ]);

    // Mapping Data Pengumuman/Informasi Editable
    const editableCards = dataRincian.map(item => ({
        id: item.id,
        title: item.judul || 'Tanpa Judul',
        content: item.keterangan || '-'
    }));

    res.render('admin/dashboard', {
      title: 'Dashboard Admin',
      currentPage: 'dashboard',
      user: req.session.user,
      tahunAjarList,
      selectedTahunId,
      judulTahun,
      breakdownTahun, 
      jumlahMahasiswa: ringkasan.jumlahMahasiswa || 0,
      belumDaftar: ringkasan.belumDaftar || 0,
      menungguUjian: ringkasan.menungguUjian || 0,
      sudahUjian: ringkasan.sudahUjian || 0,
      statistikRingkas,
      editableCards,
      showBarChart: true, 
      showPieChart: true,
      error: '',
      dbDebug: { name: 'Cloud PostgreSQL Connected', count: dataRincian.length }
    });

  } catch (err) {
    console.error('❌ Error load dashboard Admin:', err);
    res.status(500).send('Gagal memuat dashboard Admin.');
  }
};


// ============================================================================
// 3. DASHBOARD KAPRODI
// ============================================================================
const showDashboardKaprodi = async (req, res) => {
  if (!req.session.user) return res.redirect('/login-admin-kaprodi');

  try {
    const tahunAjarList = await TahunAjaran.getListForSelect();
    let selectedTahunId = req.query.tahun_ajaran || (tahunAjarList[0]?.id);

    // Ambil data antrean penetapan penguji secara universal (lintas tahun)
    const antreanPenguji = await Penguji.getMahasiswaBelumPenguji();

    const [ringkasan, statistikRingkas, breakdownTahun, rekapPerDosen] = await Promise.all([
        KaprodiDashboard.getRingkasanMahasiswa(selectedTahunId),
        KaprodiDashboard.getStatistikRingkas(selectedTahunId),
        AdminDashboard.getStatistikLengkapPerTahun(),
        KaprodiDashboard.getRekapPerDosen(selectedTahunId)
    ]);

    res.render('kaprodi/dashboard', {
      title: 'Dashboard Kaprodi',
      currentPage: 'dashboard',
      user: req.session.user,
      tahunAjarList,
      selectedTahunId,
      jumlahMahasiswa: ringkasan.jumlahMahasiswa || 0,
      belumDaftar: ringkasan.belumDaftar || 0,
      menungguUjian: ringkasan.menungguUjian || 0,
      sudahUjian: ringkasan.sudahUjian || 0,
      statistikRingkas,
      antreanPenguji, 
      mahasiswaBelum: antreanPenguji.slice(0, 5), // Limit tampilan list cepat
      totalAntrean: antreanPenguji.length,
      breakdownTahun,
      rekapPerDosen, 
      showBarChart: true, 
      showPieChart: true,
      error: ''
    });
  } catch (err) {
    console.error('❌ Error load dashboard Kaprodi:', err);
    res.status(500).send('Gagal memuat dashboard Kaprodi');
  }
};

// ============================================================================
// 4. LOGOUT
// ============================================================================
const logout = (req, res) => {
  // 1. Ambil role SEBELUM session di-destroy agar tidak undefined
  const role = req.session?.user?.role?.toLowerCase();
  
  req.session.destroy(err => {
    if (err) {
      console.error('❌ Error destroying session:', err);
    }

    // 2. Bersihkan cookie dengan path '/' agar benar-benar terhapus di browser
    res.clearCookie('connect.sid', { path: '/' }); 

    // 3. Logika pengalihan (Redirect)
    if (role === 'mahasiswa') {
      // Sesuaikan dengan rute login mahasiswa di app.js
      return res.redirect('/login'); 
    } else {
      // Staff (Admin/Kaprodi) diarahkan ke root atau login staff
      return res.redirect('/'); 
    }
  });
};

module.exports = {
  loginAdminKaprodi,
  showDashboardAdmin,
  showDashboardKaprodi,
  logout
};