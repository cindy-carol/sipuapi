// models/jadwalModel.js
const pool = require('../config/db');

/**
 * =====================================================
 * 1️⃣ ADMIN & KALENDER: AMBIL SELURUH JADWAL
 * =====================================================
 * Mengambil jadwal beserta ID Dosen pembimbing & penguji 
 * untuk keperluan validasi bentrok di sisi Frontend (Kalender).
 */
const getJadwalUjian = async () => {
  const result = await pool.query(`
    SELECT 
      j.id,
      m.npm, 
      m.nama, 
      TO_CHAR(j.tanggal, 'YYYY-MM-DD') AS tanggal, 
      j.jam_mulai, 
      j.jam_selesai,
      j.pelaksanaan,
      j.tempat,
      j.status_verifikasi,
      m.dosbing1_id,
      m.dosbing2_id,
      dp.dosen_id as dosen_penguji_id
    FROM jadwal j
    LEFT JOIN mahasiswa m ON j.mahasiswa_id = m.id
    LEFT JOIN dosen_penguji dp ON dp.mahasiswa_id = m.id
    ORDER BY j.tanggal ASC, j.jam_mulai ASC
  `);

  return result.rows.map(row => ({
    id: row.id,
    nama: row.nama,
    npm: row.npm,
    tanggal: row.tanggal,
    jam_mulai: row.jam_mulai,
    jam_selesai: row.jam_selesai,
    pelaksanaan: row.pelaksanaan,
    tempat: row.tempat,
    status_verifikasi: row.status_verifikasi,
    dosbing1_id: row.dosbing1_id,
    dosbing2_id: row.dosbing2_id,
    dosen_penguji_id: row.dosen_penguji_id
  }));
};

/**
 * =====================================================
 * 2️⃣ MAHASISWA: AMBIL JADWAL BERDASARKAN NPM
 * =====================================================
 */
const getJadwalByNPM = async (npm) => {
  const result = await pool.query(`
    SELECT 
      j.id,
      TO_CHAR(j.tanggal, 'YYYY-MM-DD') AS tanggal,
      j.jam_mulai, 
      j.jam_selesai,
      j.pelaksanaan,
      j.tempat,
      j.status_verifikasi,
      m.npm, 
      m.nama
    FROM jadwal j
    LEFT JOIN mahasiswa m ON j.mahasiswa_id = m.id
    WHERE m.npm = $1
    ORDER BY j.tanggal ASC, j.jam_mulai ASC
  `, [npm]);

  return result.rows.map(r => ({
    id: r.id,
    npm: r.npm,
    nama: r.nama,
    tanggal: r.tanggal,
    jam_mulai: r.jam_mulai,
    jam_selesai: r.jam_selesai,
    pelaksanaan: r.pelaksanaan,
    tempat: r.tempat,
    status_verifikasi: r.status_verifikasi
  }));
};

/**
 * =====================================================
 * 3️⃣ MAHASISWA: SIMPAN/UPDATE JADWAL (WITH RESET LOGIC)
 * =====================================================
 * Alur: Validasi -> Save Jadwal -> Reset Penguji & Surat jika revisi.
 */
const saveJadwalMahasiswa = async (npm, tanggal, jamMulai, jamSelesai, pelaksanaan, tempat) => {
  
  // 1. Normalisasi Lokasi
  let lokasiFix = tempat;
  if (!lokasiFix || lokasiFix.trim() === '') {
      lokasiFix = (pelaksanaan === 'online') ? 'Zoom Meeting' : 'Ruang Sidang (Menunggu Konfirmasi)';
  }

  // 2. Ambil Identitas
  const mhsRes = await pool.query('SELECT id, akun_id FROM mahasiswa WHERE npm = $1', [npm]);
  if (!mhsRes.rows[0]) throw new Error('Mahasiswa tidak ditemukan');
  
  const mahasiswaId = mhsRes.rows[0].id;
  const akunId = mhsRes.rows[0].akun_id; 

  const cek = await pool.query('SELECT id FROM jadwal WHERE mahasiswa_id = $1', [mahasiswaId]);
  let existingId = cek.rows.length > 0 ? cek.rows[0].id : -1;

  let jadwalId;
  
  if (existingId !== -1) {
    // ✏️ UPDATE JADWAL
    jadwalId = existingId;

    await pool.query(`
      UPDATE jadwal
      SET tanggal = $1::date, jam_mulai = $2::time, jam_selesai = $3::time,
          pelaksanaan = $4::text, tempat = $5::text, is_edited = TRUE, 
          edited_at = CURRENT_TIMESTAMP, edited_by = $7::integer, 
          status_verifikasi = FALSE  
      WHERE id = $6::integer
    `, [tanggal, jamMulai, jamSelesai, pelaksanaan, lokasiFix, jadwalId, akunId]);

    // 🔥 RESET TOTAL RELASI PENGUJI (Mhs ganti jadwal = Penguji lama gugur/perlu plotting ulang)
    await pool.query(`UPDATE daftar_ujian SET dosen_penguji_id = NULL WHERE mahasiswa_id = $1`, [mahasiswaId]);
    await pool.query(`UPDATE surat SET dosen_penguji_id = NULL, is_diterbitkan = FALSE, path_file = NULL WHERE jadwal_id = $1`, [jadwalId]);
    await pool.query(`DELETE FROM dosen_penguji WHERE mahasiswa_id = $1`, [mahasiswaId]);

  } else {
    // ➕ INSERT JADWAL BARU
    const res = await pool.query(`
      INSERT INTO jadwal (mahasiswa_id, tanggal, jam_mulai, jam_selesai, pelaksanaan, tempat, status_verifikasi)
      VALUES ($1, $2::date, $3::time, $4::time, $5::text, $6::text, FALSE)
      RETURNING id
    `, [mahasiswaId, tanggal, jamMulai, jamSelesai, pelaksanaan, lokasiFix]);
    
    jadwalId = res.rows[0].id;
  }

  // FINAL: Update Status ke Meja Admin
  await pool.query(`
    UPDATE daftar_ujian 
    SET jadwal_id = $1, 
        status_pendaftaran = 'Menunggu verifikasi jadwal'
    WHERE mahasiswa_id = $2
  `, [jadwalId, mahasiswaId]);

  return jadwalId;
};

/**
 * =====================================================
 * 4️⃣ ADMIN: VERIFIKASI JADWAL
 * =====================================================
 */
const updateVerifikasiJadwal = async (jadwalId, status) => {
  try {
    const resJadwal = await pool.query(`
      UPDATE jadwal
      SET status_verifikasi = $2
      WHERE id = $1
      RETURNING mahasiswa_id, status_verifikasi
    `, [jadwalId, status]);

    const row = resJadwal.rows[0];

    // Jika ACC (TRUE), buat slot di antrean plotting Kaprodi
    if (row && row.status_verifikasi === true) {
      const mhsId = row.mahasiswa_id;
      const cekPenguji = await pool.query('SELECT id FROM dosen_penguji WHERE mahasiswa_id = $1', [mhsId]);
      
      if (cekPenguji.rows.length === 0) {
        await pool.query('INSERT INTO dosen_penguji (mahasiswa_id, status_verifikasi) VALUES ($1, FALSE)', [mhsId]);
      }
    }
    return row;
  } catch (error) {
    console.error('Error updateVerifikasiJadwal:', error);
    throw error;
  }
};

/**
 * =====================================================
 * 5️⃣ ADMIN: AMBIL DATA JADWAL LENGKAP
 * =====================================================
 */
const getAllJadwal = async () => {
  const result = await pool.query(`
    SELECT
      j.id AS jadwal_id,
      m.npm,
      m.nama AS nama_mahasiswa,
      t.nama_tahun,
      t.semester,
      TO_CHAR(j.tanggal, 'YYYY-MM-DD') AS tanggal,
      j.jam_mulai, j.jam_selesai,
      j.pelaksanaan, j.tempat,
      j.status_verifikasi,
      d1.nama AS dosbing1, d2.nama AS dosbing2,
      d.nama AS dosen,
      CASE WHEN j.status_verifikasi = TRUE THEN 'confirmed' ELSE 'softbooked' END AS status_label
    FROM jadwal j
    LEFT JOIN mahasiswa m ON j.mahasiswa_id = m.id
    LEFT JOIN dosen d1 ON m.dosbing1_id = d1.id
    LEFT JOIN dosen d2 ON m.dosbing2_id = d2.id
    LEFT JOIN tahun_ajaran t ON t.id = m.tahun_ajaran_id
    LEFT JOIN dosen_penguji dp ON dp.mahasiswa_id = m.id
    LEFT JOIN dosen d ON dp.dosen_id = d.id
    ORDER BY j.tanggal ASC, j.jam_mulai ASC
  `);

  return result.rows.map(r => ({
    id: r.jadwal_id,
    npm: r.npm,
    nama: r.nama_mahasiswa,
    tanggal: r.tanggal,
    status_verifikasi: r.status_verifikasi,
    status_label: r.status_label,
    dosbing1: r.dosbing1,
    dosbing2: r.dosbing2,
    dosen_penguji: r.dosen
  }));
};

/**
 * =====================================================
 * 6️⃣ MAHASISWA: HAPUS JADWAL
 * =====================================================
 */
const deleteJadwalByNPM = async (npm) => {
    const mhsRes = await pool.query('SELECT id FROM mahasiswa WHERE npm = $1', [npm]);
    if (mhsRes.rows.length > 0) {
        const mahasiswaId = mhsRes.rows[0].id;
        const jadRes = await pool.query('SELECT id FROM jadwal WHERE mahasiswa_id = $1', [mahasiswaId]);
        if (jadRes.rows.length > 0) {
            const jadwalId = jadRes.rows[0].id;
            await pool.query(`UPDATE daftar_ujian SET jadwal_id = NULL, surat_id = NULL WHERE jadwal_id = $1`, [jadwalId]);
            await pool.query('DELETE FROM surat WHERE mahasiswa_id = $1', [mahasiswaId]);
            await pool.query('DELETE FROM jadwal WHERE id = $1', [jadwalId]);
        }
    }
};

module.exports = {
  getJadwalUjian,
  getJadwalByNPM,
  saveJadwalMahasiswa,
  deleteJadwalByNPM,
  updateVerifikasiJadwal,
  getAllJadwal
};