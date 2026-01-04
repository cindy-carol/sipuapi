// models/suratModel.js
const pool = require('../config/db');

/**
 * ============================================================
 * 🔧 UTILITY: FORMAT TANGGAL INDONESIA
 * ============================================================
 */
// Fungsi standar (pake hari) buat Jadwal Ujian
const formatTanggalIndonesia = (tanggal) => {
  if (!tanggal) return null;
  return new Date(tanggal).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
};

// FUNGSI KHUSUS (Tanpa hari) buat Tanggal Surat di pojok kanan atas
const formatTanggalSurat = (tanggal) => {
  if (!tanggal) return null;
  return new Date(tanggal).toLocaleDateString('id-ID', {
    day: 'numeric', // Tanpa 0 di depan (misal: 4 Januari 2026)
    month: 'long',
    year: 'numeric'
  });
};

/**
 * ============================================================
 * 🔎 1. AMBIL DATA KAPRODI (Untuk TTD Surat)
 * ============================================================
 */
const getKaprodi = async () => {
  const { rows } = await pool.query(`
    SELECT nama, nip_dosen
    FROM dosen
    WHERE LOWER(jabatan) = 'kaprodi'
    LIMIT 1
  `);
  return rows[0] || null;
};

/**
 * ============================================================
 * 📌 2. DAFTAR ANTREAN SURAT (MAHASISWA SIAP SURAT)
 * ============================================================
 * Mengambil mahasiswa yang:
 * - Berkas sudah ACC
 * - Penguji sudah di-plot oleh Kaprodi
 * - Surat belum diterbitkan
 */
const getMahasiswaBelumSurat = async (tahunId = null) => {
  const params = [];
  let query = `
    SELECT 
      m.id AS mahasiswa_id,
      m.npm,
      m.nama,
      t.nama_tahun,
      t.semester,
      d1.nama AS dosbing1,
      d2.nama AS dosbing2,
      ARRAY_AGG(DISTINCT dp.dosen_id) AS penguji_id,
      ARRAY_AGG(DISTINCT d.nama) AS penguji,
      MAX(j.tanggal) AS tanggal,
      MAX(j.jam_mulai) AS jam_mulai,
      MAX(j.jam_selesai) AS jam_selesai,
      MAX(j.tempat) AS tempat
    FROM mahasiswa m
    LEFT JOIN tahun_ajaran t ON t.id = m.tahun_ajaran_id
    LEFT JOIN dosen d1 ON m.dosbing1_id = d1.id
    LEFT JOIN dosen d2 ON m.dosbing2_id = d2.id
    LEFT JOIN dosen_penguji dp ON dp.mahasiswa_id = m.id
    LEFT JOIN dosen d ON dp.dosen_id = d.id
    LEFT JOIN jadwal j ON j.mahasiswa_id = m.id
    LEFT JOIN surat s ON s.mahasiswa_id = m.id
    LEFT JOIN berkas_ujian bu ON bu.daftar_ujian_id IN (
      SELECT id FROM daftar_ujian WHERE mahasiswa_id = m.id
    )
    WHERE TRUE
  `;

  if (tahunId) {
    params.push(tahunId);
    query += ` AND m.tahun_ajaran_id = $${params.length}`;
  }

  query += `
    GROUP BY m.id, m.npm, m.nama, t.nama_tahun, t.semester, d1.nama, d2.nama
    HAVING 
      BOOL_AND(dp.status_verifikasi = TRUE)
      AND BOOL_AND(bu.status_verifikasi = TRUE)
      AND BOOL_AND(COALESCE(s.is_diterbitkan, FALSE) = FALSE)
  `;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * ============================================================
 * 📄 3. AMBIL DETAIL SURAT (Untuk View/Cetak)
 * ============================================================
 */
const getSuratByMahasiswa = async (npm) => {
  const { rows } = await pool.query(`
    SELECT 
      s.id AS surat_id,
      s.nama_surat,
      s.path_file,
      s.is_diterbitkan,
      s.tanggal_dibuat,
      m.npm,
      m.nama AS nama_mahasiswa,
      d1.nama AS dosbing1,
      d2.nama AS dosbing2,
      j.tanggal,
      j.jam_mulai,
      j.jam_selesai,
      j.tempat,
      j.pelaksanaan,
      j.link_zoom,
      j.meeting_id,
      j.passcode,
      ARRAY_AGG(DISTINCT d.nama) AS penguji
    FROM mahasiswa m
    LEFT JOIN surat s ON s.mahasiswa_id = m.id
    LEFT JOIN jadwal j ON j.id = s.jadwal_id
    LEFT JOIN dosen d1 ON m.dosbing1_id = d1.id
    LEFT JOIN dosen d2 ON m.dosbing2_id = d2.id
    LEFT JOIN dosen_penguji dp ON dp.mahasiswa_id = m.id
    LEFT JOIN dosen d ON dp.dosen_id = d.id
    WHERE m.npm = $1
    GROUP BY s.id, m.npm, m.nama, d1.nama, d2.nama, j.tanggal, j.jam_mulai, j.jam_selesai, j.tempat, j.pelaksanaan, j.link_zoom, j.meeting_id, j.passcode
  `, [npm]);

  if (!rows[0]) return null;

  const kaprodi = await getKaprodi();

  return {
    surat_id: rows[0].surat_id,
    nomor_surat: rows[0].nama_surat,
    tanggalSurat: formatTanggalSurat(rows[0].tanggal_dibuat),
    kaprodi: kaprodi || null,
    mahasiswa: { npm: rows[0].npm, nama: rows[0].nama_mahasiswa },
    dosbing: [rows[0].dosbing1, rows[0].dosbing2],
    penguji: rows[0].penguji || [],
    jadwal: {
      tanggal: formatTanggalIndonesia(rows[0].tanggal),
      waktu: `${rows[0].jam_mulai?.slice(0,5)} - ${rows[0].jam_selesai?.slice(0,5)}`,
      tempat: rows[0].tempat,
      pelaksanaan: rows[0].pelaksanaan,
      linkZoom: rows[0].link_zoom || '',
      meetingID: rows[0].meeting_id || '',
      passcode: rows[0].passcode || ''
    }
  };
};

// models/suratModel.js

// ... (kode formatTanggalIndonesia dan getKaprodi tetap sama)

/**
 * AMBIL DETAIL SURAT LENGKAP (Digunakan oleh Controller untuk render PDF)
 */
const getSuratLengkapByNPM = async (npm) => {
  const { rows } = await pool.query(`
    SELECT 
      m.nama, m.npm,
      d1.nama AS dosbing1,
      d2.nama AS dosbing2,
      j.tanggal, j.jam_mulai, j.jam_selesai, j.tempat, j.pelaksanaan,
      j.link_zoom, j.meeting_id, j.passcode,
      s.nama_surat, 
      CURRENT_TIMESTAMP AS tanggal_cetak, -- Set variabel tanggalSurat jadi NOW
      ARRAY_AGG(DISTINCT d.nama) AS penguji_list
    FROM mahasiswa m
    LEFT JOIN surat s ON s.mahasiswa_id = m.id
    LEFT JOIN jadwal j ON j.id = s.jadwal_id
    LEFT JOIN dosen d1 ON m.dosbing1_id = d1.id
    LEFT JOIN dosen d2 ON m.dosbing2_id = d2.id
    LEFT JOIN dosen_penguji dp ON dp.mahasiswa_id = m.id
    LEFT JOIN dosen d ON dp.dosen_id = d.id
    WHERE m.npm = $1
    GROUP BY m.id, s.id, j.id, d1.id, d2.id
  `, [npm]);

  if (!rows[0]) return null;

  const r = rows[0];
  const kaprodi = await getKaprodi();

  return {
    namaMahasiswa: r.nama,
    npm: r.npm,
    pembimbing1: r.dosbing1 || '-',
    pembimbing2: r.dosbing2 || '-',
    penguji: r.penguji_list ? r.penguji_list.join(', ') : 'Belum Ditentukan',
    tanggalUjian: formatTanggalIndonesia(r.tanggal),
    waktuUjian: `${r.jam_mulai?.slice(0,5)} - ${r.jam_selesai?.slice(0,5)} WIB`,
    tempatUjian: r.tempat || '-',
    tipeUjian: r.pelaksanaan || 'offline',
    linkZoom: r.link_zoom,
    meetingID: r.meeting_id,
    passcode: r.passcode,
    nomorSurat: r.nama_surat || 'Draft',
    tanggalSurat: formatTanggalIndonesia(r.tanggal_cetak), // Output: Tanggal Hari Ini (NOW)
    kaprodi: kaprodi
  };
};

// models/suratModel.js
const updateLastDownload = async (npm) => {
  const query = `
    UPDATE surat
    SET last_download_at = NOW(), -- Refresh waktu ke detik ini
        is_diterbitkan = TRUE 
    WHERE mahasiswa_id = (SELECT id FROM mahasiswa WHERE npm = $1)
    RETURNING last_download_at;
  `;
  const { rows } = await pool.query(query, [npm]);
  return rows[0];
};

/**
 * ============================================================
 * 📝 4. INSERT SURAT (DRAFT)
 * ============================================================
 */
const insertSurat = async ({
  mahasiswaId,
  dosbing1Id,
  dosbing2Id,
  dosenPengujiId,
  jadwalId,
  namaSurat,
  pelaksanaan = 'offline'
}) => {
  const tanggalDibuat = new Date();
  const { rows } = await pool.query(`
    INSERT INTO surat (
      mahasiswa_id, dosbing1_id, dosbing2_id, dosen_penguji_id, 
      jadwal_id, nama_surat, path_file, pelaksanaan, tanggal_dibuat
    ) 
    VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $8)
    RETURNING *
  `, [mahasiswaId, dosbing1Id, dosbing2Id, dosenPengujiId, jadwalId, namaSurat, pelaksanaan, tanggalDibuat]);

  return rows[0];
};

/**
 * ============================================================
 * 🚀 5. UPLOAD SURAT FINAL (TTD/SCAN)
 * ============================================================
 */
const uploadSuratFinal = async (npm, relativePath, editorId) => {
  const query = `
    UPDATE surat
    SET path_file = $1, 
        is_diterbitkan = TRUE,
        is_edited = TRUE, 
        edited_by = $3, 
        edited_at = CURRENT_TIMESTAMP
    WHERE mahasiswa_id = (SELECT id FROM mahasiswa WHERE npm = $2)
    RETURNING *
  `;
  const { rows } = await pool.query(query, [relativePath, npm, editorId]);
  return rows[0];
};

/**
 * ============================================================
 * 🗑️ 6. HAPUS FILE SURAT (RESET)
 * ============================================================
 */
const deleteSuratFile = async (npm) => {
  const query = `
    UPDATE surat
    SET path_file = NULL, 
        is_diterbitkan = FALSE,
        is_edited = TRUE, 
        edited_at = CURRENT_TIMESTAMP
    WHERE mahasiswa_id = (SELECT id FROM mahasiswa WHERE npm = $1)
    RETURNING path_file
  `;
  const { rows } = await pool.query(query, [npm]);
  return rows[0];
};

module.exports = {
  formatTanggalIndonesia,
  formatTanggalSurat,
  getKaprodi,
  getMahasiswaBelumSurat,
  getSuratByMahasiswa,
  getSuratLengkapByNPM,
  updateLastDownload,
  insertSurat,
  uploadSuratFinal,
  deleteSuratFile
};