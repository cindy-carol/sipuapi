const pool = require('../config/db.js');
const bcrypt = require('bcryptjs');

/* ============================================================
🔹 UTILITAS PASSWORD (Hanya untuk admin/kaprodi)
============================================================ */
const hashPassword = async (passwordPlain) => {
const salt = await bcrypt.genSalt(10);
return await bcrypt.hash(passwordPlain, salt);
};

const verifyPassword = async (passwordPlain, passwordHash) => {
return await bcrypt.compare(passwordPlain, passwordHash);
};

/* ============================================================
🔹 AKSI TERHADAP DATA AKUN
============================================================ */

// Ambil user berdasarkan username
const getUserByUsername = async (username) => {
const res = await pool.query(`  
    SELECT id, username, password, role, status_aktif, tanggal_dibuat  
    FROM akun  
    WHERE username = $1  
  `, [username]);
return res.rows[0] || null;
};

// Buat user baru (tanpa password untuk mahasiswa)
const createUser = async ({ username, role, password = null }) => {
const res = await pool.query(`  
    INSERT INTO akun (username, password, role, status_aktif)  
    VALUES ($1, $2, $3, TRUE)  
    RETURNING id, username, role, status_aktif  
  `, [username, password, role]);

return res.rows[0];
};

// Sinkronisasi akun mahasiswa
const syncMahasiswaAccounts = async () => {
const res = await pool.query(`  
    SELECT id, npm, nama, akun_id  
    FROM mahasiswa  
  `);

if (res.rows.length === 0) {
console.log('⚠️ Tidak ada mahasiswa di tabel.');
return [];
}

const created = [];

for (const mhs of res.rows) {
// Cek akun mahasiswa sudah ada
const existing = await pool.query(`  
      SELECT id FROM akun WHERE username = $1 AND role = 'mahasiswa'  
    `, [mhs.npm]);

let akunId;  

if (existing.rows.length > 0) {  
  akunId = existing.rows[0].id;  
  if (!mhs.akun_id) {  
    await pool.query(`UPDATE mahasiswa SET akun_id = $1 WHERE id = $2`, [akunId, mhs.id]);  
    console.log(`🔗 FK akun_id disambungkan untuk ${mhs.npm}`);  
  } else {  
    console.log(`✅ ${mhs.npm} sudah punya akun & akun_id`);  
  }  
} else {  
  // Buat akun mahasiswa tanpa password  
  const akunRes = await createUser({ username: mhs.npm, role: 'mahasiswa' });  
  akunId = akunRes.id;  
  await pool.query(`UPDATE mahasiswa SET akun_id = $1 WHERE id = $2`, [akunId, mhs.id]);  
  console.log(`🧾 Akun dibuat & ditautkan untuk ${mhs.npm} (${mhs.nama})`);  
}  

created.push({ npm: mhs.npm, akun_id: akunId });  

}

console.log(`🎓 Total ${created.length} mahasiswa sudah tersinkron dengan akun.`);
return created;
};

const setKapordi = async (dosenIdBaru) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Nonaktifkan kaprodi lama
    await client.query(`
      UPDATE akun
      SET status_aktif = FALSE
      WHERE role = 'kaprodi'
    `);

    // 2. Ambil data dosen baru
    const result = await client.query(`
      SELECT nip, nama
      FROM dosen
      WHERE id = $1
    `, [dosenIdBaru]);

    if (result.rows.length === 0) throw new Error("Dosen tidak ditemukan");

    const { nip } = result.rows[0];

    // 3. Generate akun baru
   // SESUDAH (Password 'kaprodi' dipindah ke .env)
const passKaprodi = process.env.PASSWORD_DEFAULT_KAPRODI;
await client.query(`
  INSERT INTO akun (username, password, role, status_aktif)
  VALUES ($1, $2, 'kaprodi', TRUE)
`, [nip, passKaprodi]);
    // 4. Update jabatan dosen (jika perlu)
    await client.query(`
      UPDATE dosen
      SET jabatan = 'Kaprodi'
      WHERE id = $1
    `, [dosenIdBaru]);

    await client.query('COMMIT');
    return true;

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};


// Ambil semua akun
const getAllUsers = async () => {
const res = await pool.query(`  
    SELECT id, username, role, status_aktif, tanggal_dibuat  
    FROM akun  
    ORDER BY tanggal_dibuat DESC  
  `);
return res.rows;
};

/* ============================================================
🔹 EKSPOR
============================================================ */
module.exports = {
getUserByUsername,
createUser,
syncMahasiswaAccounts,
hashPassword,
verifyPassword,
getAllUsers
};
