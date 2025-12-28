// controllers/profileController.js
const pool = require('@config/db'); // Sesuaikan path db kamu
const bcrypt = require('bcrypt');

const updateProfile = async (req, res) => {
    const { nama, currentPassword, newPassword, confirmPassword } = req.body;
    
    // Pastikan user login
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Sesi habis, silakan login ulang.' });
    }

    const userId = req.session.user.id;

    try {
        // 1. Ambil data user
        const userRes = await pool.query('SELECT * FROM akun WHERE id = $1', [userId]);
        const user = userRes.rows[0];

        // 2. Update Nama (Jika ada input nama)
        if (nama && nama.trim() !== "") {
            await pool.query('UPDATE akun SET nama = $1 WHERE id = $2', [nama, userId]);
            req.session.user.nama = nama; // Update session biar header berubah realtime
        }

        // 3. Update Password (Hanya jika kolom diisi)
        if (newPassword || currentPassword) {
            // Validasi kelengkapan
            if (!currentPassword || !newPassword || !confirmPassword) {
                return res.status(400).json({ success: false, message: 'Form password tidak lengkap!' });
            }
            if (newPassword !== confirmPassword) {
                return res.status(400).json({ success: false, message: 'Konfirmasi password baru tidak cocok.' });
            }

            // Cek Password Lama (Bcrypt / Plaintext support)
            let isMatch = false;
            if (user.password.startsWith('$2b$')) {
                isMatch = await bcrypt.compare(currentPassword, user.password);
            } else {
                isMatch = (user.password === currentPassword);
            }

            if (!isMatch) {
                return res.status(400).json({ success: false, message: 'Password lama salah!' });
            }

            // Hash & Simpan
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(newPassword, salt);
            await pool.query('UPDATE akun SET password = $1 WHERE id = $2', [hash, userId]);
        }

        res.json({ success: true, message: 'Profil berhasil diperbarui!' });

    } catch (err) {
        console.error('Profile Update Error:', err);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
    }
};

module.exports = { updateProfile };