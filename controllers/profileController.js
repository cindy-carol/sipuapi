// controllers/profileController.js
const pool = require('../config/db');
const bcrypt = require('bcrypt');

const updateProfile = async (req, res) => {
    const { nama, currentPassword, newPassword, confirmPassword } = req.body;
    
    // 1. Proteksi Sesi: Pastikan user login
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Sesi habis, silakan login ulang.' });
    }

    const userId = req.session.user.id;

    try {
        // 2. Ambil data user terbaru dari DB
        const userRes = await pool.query('SELECT password FROM akun WHERE id = $1', [userId]);
        const user = userRes.rows[0];

        if (!user) {
            return res.status(404).json({ success: false, message: 'Akun tidak ditemukan.' });
        }

        // 3. Update Nama (Hanya jika ada perubahan dan tidak kosong)
        if (nama && nama.trim() !== "" && nama !== req.session.user.nama) {
            await pool.query('UPDATE akun SET nama = $1 WHERE id = $2', [nama, userId]);
            req.session.user.nama = nama; // Sinkronkan session
        }

        // 4. Update Password (Hanya jika kolom password lama diisi)
        if (currentPassword) {
            // Validasi Input
            if (!newPassword || !confirmPassword) {
                return res.status(400).json({ success: false, message: 'Lengkapi form password baru.' });
            }
            if (newPassword !== confirmPassword) {
                return res.status(400).json({ success: false, message: 'Konfirmasi password baru tidak cocok.' });
            }
            if (newPassword.length < 6) {
                return res.status(400).json({ success: false, message: 'Password baru minimal 6 karakter.' });
            }

            // Verifikasi Password Lama (Wajib Bcrypt)
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                return res.status(400).json({ success: false, message: 'Password lama salah!' });
            }

            // Keamanan Tambahan: Cek jika password baru sama dengan yang lama
            const isSame = await bcrypt.compare(newPassword, user.password);
            if (isSame) {
                return res.status(400).json({ success: false, message: 'Password baru tidak boleh sama dengan yang lama.' });
            }

            // Hash & Simpan
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(newPassword, salt);
            await pool.query('UPDATE akun SET password = $1 WHERE id = $2', [hash, userId]);
        }

        res.json({ success: true, message: 'Profil berhasil diperbarui!' });

    } catch (err) {
        console.error('❌ Profile Update Error:', err);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan sistem.' });
    }
};

module.exports = { updateProfile };