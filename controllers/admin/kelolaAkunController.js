// controllers/admin/akunController.js
const pool = require('../../config/db'); 
const bcrypt = require('bcrypt');

const akunController = {

  // =========================================================================
  // 👥 1. TAMPILKAN HALAMAN KELOLA AKUN
  // =========================================================================
  getHalamanKelolaAkun: async (req, res) => {
    try {
      // Mengambil data akun Admin dan Kaprodi
      const query = `
        SELECT id, username, nama, role, status_aktif 
        FROM akun 
        WHERE role IN ('admin', 'kaprodi') 
        ORDER BY role ASC, id ASC
      `;
      const result = await pool.query(query);

      res.render('admin/kelola-akun', { 
        title: 'Kelola Akun Pengguna',
        currentPage: 'kelola-akun',
        user: req.session.user, 
        listAkun: result.rows,
        // Menggunakan environment variables untuk password default
        defaultPasswordAdmin: process.env.PASSWORD_DEFAULT_ADMIN_BARU || 'admin123', 
        defaultPasswordReset: process.env.PASSWORD_DEFAULT_RESET || '123456'
      });

    } catch (err) {
      console.error('❌ Error getHalamanKelolaAkun:', err);
      res.status(500).send('Terjadi kesalahan server');
    }
  },

  // =========================================================================
  // ➕ 2. TAMBAH ADMIN BARU
  // =========================================================================
  tambahAdmin: async (req, res) => {
    const { nama, username, password } = req.body;
    
    try {
      // Validasi duplikasi username
      const cekUser = await pool.query('SELECT id FROM akun WHERE username = $1', [username]);
      if (cekUser.rows.length > 0) {
        return res.status(400).json({ success: false, message: 'Username sudah dipakai!' });
      }

      // Hashing password secara aman
      const passwordAdmin = password || process.env.PASSWORD_DEFAULT_ADMIN_BARU;
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(passwordAdmin, salt);

      await pool.query(
        'INSERT INTO akun (nama, username, password, role, status_aktif, tanggal_dibuat) VALUES ($1, $2, $3, $4, $5, NOW())',
        [nama, username, hash, 'admin', true]
      );

      res.json({ success: true, message: 'Admin baru berhasil ditambahkan!' });

    } catch (err) {
      console.error('❌ Error tambahAdmin:', err);
      res.status(500).json({ success: false, message: 'Gagal menambah admin.' });
    }
  },

  // =========================================================================
  // 🔑 3. HELPER: VERIFIKASI PASSWORD ADMIN (SECURITY CHECK)
  // =========================================================================
  verifikasiAdmin: async (adminId, inputPassword) => {
    const res = await pool.query('SELECT password FROM akun WHERE id = $1', [adminId]);
    if (res.rows.length === 0) return false;
    
    const hash = res.rows[0].password;
    // Membandingkan input dengan hash di database
    return await bcrypt.compare(inputPassword, hash);
  },

  // =========================================================================
  // 🔄 4. RESET PASSWORD USER (ADMIN/KAPRODI)
  // =========================================================================
  resetPassword: async (req, res) => {
    const { targetUserId, adminPassword } = req.body;
    const adminId = req.session.user.id;

    try {
      // Verifikasi identitas admin sebelum melakukan tindakan sensitif
      const isVerified = await akunController.verifikasiAdmin(adminId, adminPassword);
      if (!isVerified) {
        return res.status(401).json({ success: false, message: 'Password Admin Salah! Akses Ditolak.' });
      }

      const passwordDefault = process.env.PASSWORD_DEFAULT_RESET || '123456'; 
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(passwordDefault, salt);
      
      await pool.query('UPDATE akun SET password = $1 WHERE id = $2', [hash, targetUserId]);

      res.json({ success: true, message: 'Password berhasil direset ke default!' });

    } catch (err) {
      console.error('❌ Error resetPassword:', err);
      res.status(500).json({ success: false, message: 'Gagal mereset password.' });
    }
  },

  // =========================================================================
  // 🔘 5. TOGGLE STATUS (AKTIF/NON-AKTIF)
  // =========================================================================
  toggleStatus: async (req, res) => {
    const { targetUserId, statusBaru, adminPassword } = req.body;
    const adminId = req.session.user.id;

    try {
      // Proteksi: Admin tidak boleh menonaktifkan akunnya sendiri
      if (parseInt(targetUserId) === parseInt(adminId)) {
        return res.status(400).json({ success: false, message: 'Akses Ditolak: Anda tidak bisa menonaktifkan akun sendiri.' });
      }

      const isVerified = await akunController.verifikasiAdmin(adminId, adminPassword);
      if (!isVerified) {
        return res.status(401).json({ success: false, message: 'Password Admin Salah! Gagal mengubah status.' });
      }

      await pool.query('UPDATE akun SET status_aktif = $1 WHERE id = $2', [statusBaru, targetUserId]);
      res.json({ success: true, message: 'Status akun berhasil diperbarui.' });

    } catch (err) {
      console.error('❌ Error toggleStatus:', err);
      res.status(500).json({ success: false, message: 'Server Error saat mengubah status.' });
    }
  }
};

module.exports = akunController;