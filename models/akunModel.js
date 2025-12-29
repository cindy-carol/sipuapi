// models/akunModel.js
const pool = require('../config/db');
const bcrypt = require('bcryptjs');

/**
 * ============================================================
 * 🛡️ UTILITAS PASSWORD
 * ============================================================
 * Digunakan untuk enkripsi password Admin dan Kaprodi.
 * Mahasiswa menggunakan login NPM (Tanpa Password/SSO Style).
 */
const hashPassword = async (passwordPlain) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(passwordPlain, salt);
};

const verifyPassword = async (passwordPlain, passwordHash) => {
  return await bcrypt.compare(passwordPlain, passwordHash);
};

/**
 * ============================================================
 * 🔍 AKSI TERHADAP DATA AKUN
 * ============================================================
 */

// Mengambil user berdasarkan username (NIP untuk Dosen, NPM untuk Mahasiswa)
const getUserByUsername = async (username) => {
  const res = await pool.query(`  
    SELECT id, username, password, role, status_aktif, tanggal_dibuat  
    FROM akun  
    WHERE username = $1  
  `, [username]);
  return res.rows[0] || null;
};

// Membuat user baru ke dalam tabel akun
const createUser = async ({ username, role, password = null }) => {
  const res = await pool.query(`  
    INSERT INTO akun (username, password, role, status_aktif)  
    VALUES ($1, $2, $3, TRUE)  
    RETURNING id, username, role, status_aktif  
  `, [username, password, role]);

  return res.rows[0];
};

/**
 * 🔄 SINKRONISASI AKUN MAHASISWA
 * Fungsi ini memastikan setiap Mahasiswa di tabel 'mahasiswa' 
 * memiliki kredensial di tabel 'akun' agar bisa login ke dashboard.
 */
const syncMahasiswaAccounts = async () => {
  const res = await pool.query(`  
    SELECT id, npm, nama, akun_id  
    FROM mahasiswa  
  `);

  if (res.rows.length === 0) {
    console.log('⚠️ Tidak ada mahasiswa di tabel untuk disinkronisasi.');
    return [];
  }

  const created = [];

  for (const mhs of res.rows) {
    // Cek apakah username (NPM) sudah ada di tabel akun
    const existing = await pool.query(`  
      SELECT id FROM akun WHERE username = $1 AND role = 'mahasiswa'  
    `, [mhs.npm]);

    let akunId;  

    if (existing.rows.length > 0) {  
      akunId = existing.rows[0].id;  
      // Jika di tabel mahasiswa belum terhubung (akun_id null), kita hubungkan
      if (!mhs.akun_id) {  
        await pool.query(`UPDATE mahasiswa SET akun_id = $1 WHERE id = $2`, [akunId, mhs.id]);  
        console.log(`🔗 Jalur akun_id disambungkan untuk NPM: ${mhs.npm}`);  
      }
    } else {  
      // Jika belum punya akun sama sekali, buatkan akun baru (password null)
      const akunRes = await createUser({ username: mhs.npm, role: 'mahasiswa' });  
      akunId = akunRes.id;  
      await pool.query(`UPDATE mahasiswa SET akun_id = $1 WHERE id = $2`, [akunId, mhs.id]);  
      console.log(`🧾 Akun baru dibuat & ditautkan untuk: ${mhs.npm} (${mhs.nama})`);  
    }  

    created.push({ npm: mhs.npm, akun_id: akunId });  
  }

  console.log(`🎓 Total ${created.length} akun mahasiswa sinkron.`);
  return created;
};

/**
 * 🎓 PENETAPAN KAPRODI BARU
 * Menggunakan Database Transaction (BEGIN/COMMIT) untuk memastikan
 * proses penonaktifan Kaprodi lama dan aktivasi Kaprodi baru berjalan atomik.
 */
const setKapordi = async (dosenIdBaru) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Nonaktifkan status aktif Kaprodi lama
    await client.query(`
      UPDATE akun
      SET status_aktif = FALSE
      WHERE role = 'kaprodi'
    `);

    // 2. Ambil data NIP dosen yang akan jadi Kaprodi baru
    const result = await client.query(`
      SELECT nip, nama
      FROM dosen
      WHERE id = $1
    `, [dosenIdBaru]);

    if (result.rows.length === 0) throw new Error("Dosen tidak ditemukan");

    const { nip } = result.rows[0];

    // 3. Buat akun Kaprodi baru menggunakan password dari Environment Variable
    const passKaprodi = process.env.PASSWORD_DEFAULT_KAPRODI; 
    await client.query(`
      INSERT INTO akun (username, password, role, status_aktif)
      VALUES ($1, $2, 'kaprodi', TRUE)
    `, [nip, passKaprodi]);

    // 4. Update kolom jabatan di tabel dosen
    await client.query(`
      UPDATE dosen
      SET jabatan = 'Kaprodi'
      WHERE id = $1
    `);

    await client.query('COMMIT');
    return true;

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Mengambil list seluruh akun untuk Monitoring Super Admin
const getAllUsers = async () => {
  const res = await pool.query(`  
    SELECT id, username, role, status_aktif, tanggal_dibuat  
    FROM akun  
    ORDER BY tanggal_dibuat DESC  
  `);
  return res.rows;
};

/* ============================================================
🔹 EKSPOR MODEL
============================================================ */
module.exports = {
  getUserByUsername,
  createUser,
  syncMahasiswaAccounts,
  hashPassword,
  verifyPassword,
  getAllUsers,
  setKapordi
};