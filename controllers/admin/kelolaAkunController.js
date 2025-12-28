const pool = require('@config/db.js'); // Sesuaikan path config DB kamu
const bcrypt = require('bcrypt');

// 1. TAMPILKAN HALAMAN KELOLA AKUN
const getHalamanKelolaAkun = async (req, res) => {
    try {
        // Ambil data akun (Kecuali Mahasiswa, karena katamu mahasiswa beda urusan)
        // Kita urutkan biar Admin paling atas, lalu Kaprodi
        const query = `
            SELECT id, username, nama, role, status_aktif 
            FROM akun 
            WHERE role IN ('admin', 'kaprodi') 
            ORDER BY role ASC, id ASC
        `;
        const result = await pool.query(query);

        res.render('admin/kelola-akun', { 
            title: 'Kelola Akun',
            currentPage: 'kelola-akun',
            user: req.session.user, // Data admin yg sedang login
            listAkun: result.rows,   // Data untuk tabel
            defaultPasswordAdmin: process.env.PASSWORD_DEFAULT_ADMIN_BARU, // Kirim password default admin baru ke view
            defaultPasswordReset: process.env.PASSWORD_DEFAULT_RESET // Kirim password default reset ke view
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Terjadi kesalahan server');
    }
};

// 2. TAMBAH ADMIN BARU
const tambahAdmin = async (req, res) => {
    const { nama, username, password } = req.body;
    
    try {
        // Cek username kembar
        const cekUser = await pool.query('SELECT id FROM akun WHERE username = $1', [username]);
        if (cekUser.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Username sudah dipakai!' });
        }

        // Hash Password
        const passwordAdmin = req.body.password || process.env.PASSWORD_DEFAULT_ADMIN_BARU;
const salt = await bcrypt.genSalt(10);
const hash = await bcrypt.hash(passwordAdmin, salt);

        // Insert ke DB (Default role: admin, status: aktif)
        await pool.query(
            'INSERT INTO akun (nama, username, password, role, status_aktif, tanggal_dibuat) VALUES ($1, $2, $3, $4, $5, NOW())',
            [nama, username, hash, 'admin', true]
        );

        res.json({ success: true, message: 'Admin baru berhasil ditambahkan!' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Gagal menambah admin.' });
    }
};

// Di controller akunController.js

// Fungsi Bantuan: Cek Password Admin
const verifikasiAdmin = async (adminId, inputPassword) => {
    // Ambil password hash admin yang sedang login dari DB
    const res = await pool.query('SELECT password FROM akun WHERE id = $1', [adminId]);
    if (res.rows.length === 0) return false;
    
    const hash = res.rows[0].password;
    // Bandingkan password inputan modal dengan hash di DB
    return await bcrypt.compare(inputPassword, hash);
};


// UPDATE: RESET PASSWORD
const resetPassword = async (req, res) => {
    const { targetUserId, adminPassword } = req.body; // Terima adminPassword
    const adminId = req.session.user.id;

    try {
        // 1. VERIFIKASI DULU!
        const isVerified = await verifikasiAdmin(adminId, adminPassword);
        if (!isVerified) {
            return res.status(401).json({ success: false, message: 'Password Admin Salah! Akses Ditolak.' });
        }

const passwordDefault = process.env.PASSWORD_DEFAULT_RESET; 
const salt = await bcrypt.genSalt(10);
const hash = await bcrypt.hash(passwordDefault, salt);
        await pool.query('UPDATE akun SET password = $1 WHERE id = $2', [hash, targetUserId]);

        res.json({ success: true, message: 'Password berhasil direset!' });

    } catch (err) {
        // ... error handling ...
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};


// UPDATE: TOGGLE STATUS
const toggleStatus = async (req, res) => {
    const { targetUserId, statusBaru, adminPassword } = req.body; // Terima adminPassword
    const adminId = req.session.user.id;

    try {
        // 1. VERIFIKASI DULU!
        const isVerified = await verifikasiAdmin(adminId, adminPassword);
        if (!isVerified) {
            return res.status(401).json({ success: false, message: 'Password Admin Salah! Gagal mengubah status.' });
        }

        // ... Lanjut logika update status ...
        await pool.query('UPDATE akun SET status_aktif = $1 WHERE id = $2', [statusBaru, targetUserId]);
        res.json({ success: true, message: 'Status akun berhasil diubah.' });

    } catch (err) {
         // ... error handling ...
         res.status(500).json({ success: false, message: 'Server Error' });
    }
};

module.exports = { getHalamanKelolaAkun, tambahAdmin, resetPassword, toggleStatus };