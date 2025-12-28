const pool = require('@config/db.js');

/* =====================================================
    ADMIN & KALENDER: Ambil jadwal (Plus ID Dosen buat Validasi Frontend)
===================================================== */
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

/* =====================================================
    MAHASISWA: Ambil jadwal terakhir berdasarkan NPM
===================================================== */
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

/* =====================================================
    MAHASISWA: Simpan Jadwal (FINAL - HAPUS PENGUJI TOTAL)
===================================================== */
/**
 * MAHASISWA: Simpan / Update Jadwal Ujian
 * Alur: Validasi Bentrok -> Update/Insert Jadwal -> Reset Relasi Penguji & Surat -> Update Progress
 */
/**
 * MAHASISWA: Simpan atau Update Jadwal Ujian
 * Alur: Validasi -> Update/Insert Jadwal -> Reset Relasi Penguji -> Increment Revisi Kondisional
 */
const saveJadwalMahasiswa = async (npm, tanggal, jamMulai, jamSelesai, pelaksanaan, tempat) => {
  
  console.log('🚀 [DEBUG] Menjalankan saveJadwalMahasiswa dengan Reset Total & Conditional Increment');

  // 1. Normalisasi Lokasi/Tempat
  let lokasiFix = tempat;
  if (!lokasiFix || lokasiFix.trim() === '') {
      lokasiFix = (pelaksanaan === 'online') ? 'Zoom Meeting' : 'Ruang Sidang (Menunggu Konfirmasi)';
  }

  // 2. Ambil Identitas Mahasiswa & Akun
  const mhsRes = await pool.query('SELECT id, akun_id FROM mahasiswa WHERE npm = $1', [npm]);
  if (!mhsRes.rows[0]) throw new Error('Mahasiswa tidak ditemukan');
  
  const mahasiswaId = mhsRes.rows[0].id;
  const akunId = mhsRes.rows[0].akun_id; 

  // 3. Cek Eksistensi Jadwal Lama
  const cek = await pool.query('SELECT id FROM jadwal WHERE mahasiswa_id = $1', [mahasiswaId]);
  let existingId = cek.rows.length > 0 ? cek.rows[0].id : -1;

  // --- [SATPAM VALIDASI BENTROK TETAP DI SINI] ---
  // Pastikan logika pengecekan bentrok ruangan dan dosen tetap dijalankan sebelum proses simpan

  let jadwalId;
  
  if (existingId !== -1) {
    // =========================================================================
    // ✏️ KASUS: UPDATE JADWAL (MAHASISWA EDIT MANDIRI)
    // =========================================================================
    jadwalId = existingId;

    // A. Update Data Utama Jadwal & Reset Status Verifikasi ke FALSE (Kuning di Kalender)
    await pool.query(`
      UPDATE jadwal
      SET tanggal = $1::date, jam_mulai = $2::time, jam_selesai = $3::time,
          pelaksanaan = $4::text, tempat = $5::text, is_edited = TRUE, 
          edited_at = CURRENT_TIMESTAMP, edited_by = $7::integer, 
          status_verifikasi = FALSE  
      WHERE id = $6::integer
    `, [tanggal, jamMulai, jamSelesai, pelaksanaan, lokasiFix, jadwalId, akunId]);

    // B. RESET TOTAL RELASI DOSEN PENGUJI (Menghindari error Foreign Key Constraint)
    // Putus hubungan dosen_penguji_id di tabel daftar_ujian
    await pool.query(`UPDATE daftar_ujian SET dosen_penguji_id = NULL WHERE mahasiswa_id = $1`, [mahasiswaId]);
    
    // Putus hubungan dosen_penguji_id di tabel surat agar draf kembali kosong
    await pool.query(`UPDATE surat SET dosen_penguji_id = NULL WHERE jadwal_id = $1`, [jadwalId]);
    
    // Hapus baris di tabel dosen_penguji agar Kaprodi melakukan plotting ulang dari awal
    await pool.query(`DELETE FROM dosen_penguji WHERE mahasiswa_id = $1`, [mahasiswaId]);

    // C. LOGIKA INCREMENT REVISI (Hanya jika sudah ada Dosen Penguji di Surat)
    // Kita cek apakah record surat sudah ada dan memiliki dosen_penguji_id
    const cekSurat = await pool.query(
        'SELECT id, dosen_penguji_id FROM surat WHERE jadwal_id = $1', 
        [jadwalId]
    );

// Di dalam jadwalModel.js (blok existingId !== -1)
if (cekSurat.rows.length > 0) {
    const surat = cekSurat.rows[0];
    
    // 🔥 LOGIKA FIX INCREMENT:
    // Pake COALESCE biar kalau masih NULL, dia jadi 0 dulu.
    const queryUpdateSurat = `
        UPDATE surat SET 
            dosen_penguji_id = NULL, 
            is_diterbitkan = FALSE,
            path_file = NULL, 
            edited_by = $2, 
            edited_at = CURRENT_TIMESTAMP,
            last_download_at = NULL
        WHERE jadwal_id = $1
    `;
    await pool.query(queryUpdateSurat, [jadwalId, akunId]);
}

  } else {
    // =========================================================================
    // ➕ KASUS: INSERT JADWAL PERTAMA KALI
    // =========================================================================
    const res = await pool.query(`
      INSERT INTO jadwal (mahasiswa_id, tanggal, jam_mulai, jam_selesai, pelaksanaan, tempat, status_verifikasi)
      VALUES ($1, $2::date, $3::time, $4::time, $5::text, $6::text, FALSE)
      RETURNING id
    `, [mahasiswaId, tanggal, jamMulai, jamSelesai, pelaksanaan, lokasiFix]);
    
    jadwalId = res.rows[0].id;

    // Catatan: Record Surat baru akan dibuat di tahap Verifikasi Admin/Oper ke Kaprodi
  }

  // =========================================================================
  // 🔥 FINALISASI: KEMBALIKAN STATUS KE MEJA ADMIN
  // =========================================================================
  // Menghubungkan jadwal_id ke daftar_ujian dan mengembalikan status ke 'Menunggu verifikasi'
  await pool.query(`
    UPDATE daftar_ujian 
    SET jadwal_id = $1, 
        status_pendaftaran = 'Menunggu verifikasi jadwal'
    WHERE mahasiswa_id = $2
  `, [jadwalId, mahasiswaId]);

  return jadwalId;
};
/* =====================================================
    ADMIN: Update status verifikasi jadwal + AUTO GENERATE PENGUJI
===================================================== */
const updateVerifikasiJadwal = async (jadwalId, status) => {
  try {
    const resJadwal = await pool.query(`
      UPDATE jadwal
      SET status_verifikasi = $2
      WHERE id = $1
      RETURNING mahasiswa_id, status_verifikasi
    `, [jadwalId, status]);

    const row = resJadwal.rows[0];

    // Jika ACC (TRUE), buat baris di dosen_penguji biar mahasiswa masuk antrean Kaprodi
    if (row && row.status_verifikasi === true) {
      const mhsId = row.mahasiswa_id;
      const cekPenguji = await pool.query('SELECT id FROM dosen_penguji WHERE mahasiswa_id = $1', [mhsId]);
      
      if (cekPenguji.rows.length === 0) {
        console.log(`✨ [AUTO-GENERATE] Masuk Antrean Penguji MHS ID: ${mhsId}`);
        await pool.query('INSERT INTO dosen_penguji (mahasiswa_id, status_verifikasi) VALUES ($1, FALSE)', [mhsId]);
      }
    }
    return row;
  } catch (error) {
    console.error('Error updateVerifikasiJadwal:', error);
    throw error;
  }
};

/* =====================================================
    AMBIL SEMUA DATA LENGKAP (ADMIN VIEW)
===================================================== */
const getAllJadwal = async () => {
  const result = await pool.query(`
    SELECT
      j.id AS jadwal_id,
      m.npm,
      m.nama AS nama_mahasiswa,
      t.nama_tahun AS nama_tahun,
      t.semester,
      TO_CHAR(j.tanggal, 'YYYY-MM-DD') AS tanggal,
      j.jam_mulai,
      j.jam_selesai,
      j.pelaksanaan,
      j.tempat,
      j.status_verifikasi,
      d1.nama AS dosbing1,
      d1.id AS dosbing1_id,
      d2.nama AS dosbing2,
      d2.id AS dosbing2_id,
      d.nama AS dosen,
      d.id AS dosen_penguji_id,
      CASE WHEN j.status_verifikasi = TRUE THEN 'confirmed'
           ELSE 'softbooked'
      END AS status_label
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
    nama_tahun: r.nama_tahun,
    semester: r.semester,
    tanggal: r.tanggal, 
    jam_mulai: r.jam_mulai,
    jam_selesai: r.jam_selesai,
    pelaksanaan: r.pelaksanaan,
    tempat: r.tempat,
    status_verifikasi: r.status_verifikasi,
    status_label: r.status_label,
    dosbing1: r.dosbing1,
    dosbing2: r.dosbing2,
    dosen_penguji: r.dosen,
    dosbing1_id: r.dosbing1_id,
    dosbing2_id: r.dosbing2_id,
    dosen_penguji_id: r.dosen_penguji_id
  }));
};

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