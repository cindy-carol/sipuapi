const pool = require('../config/db.js');

//
// 🔧 Utility Format Tanggal Indonesia
//
const formatTanggalIndonesia = (tanggal) => {
  if (!tanggal) return null;

  return new Date(tanggal).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
};

//
// 🔎 1️⃣ Ambil Kaprodi (nama + NIP)
//
const getKaprodi = async () => {
  const { rows } = await pool.query(`
    SELECT nama, nip_dosen
    FROM dosen
    WHERE LOWER(jabatan) = 'kaprodi'
    LIMIT 1
  `);
  return rows[0] || null;
};

//
// 📌 2️⃣ Ambil daftar mahasiswa yang memenuhi syarat dibuatkan surat
//
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

//
// 📄 3️⃣ Ambil detail surat by NPM (lengkap untuk PDF/EJS)
//
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

  // Ambil kaprodi
  const kaprodi = await getKaprodi();

  return {
    surat_id: rows[0].surat_id,
    nomor_surat: rows[0].nama_surat,
    tanggalSurat: formatTanggalIndonesia(rows[0].tanggal_dibuat),

    kaprodi: kaprodi || null,

    mahasiswa: { 
      npm: rows[0].npm, 
      nama: rows[0].nama_mahasiswa 
    },

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


//
// 📝 4️⃣ Insert surat baru (DRAFT AWAL)
// path_file diset NULL karena belum ada file fisik
//
const insertSurat = async ({
  mahasiswaId,
  dosbing1Id,
  dosbing2Id,
  dosenPengujiId,
  jadwalId,
  namaSurat,
  // pathFile, <-- Dihapus karena belum upload
  pelaksanaan = 'offline'
}) => {

  // Pakai 'new Date()' biar format timestamp database valid
  const tanggalDibuat = new Date();

  const { rows } = await pool.query(`
    INSERT INTO surat (
      mahasiswa_id, dosbing1_id, dosbing2_id, dosen_penguji_id, 
      jadwal_id, nama_surat, path_file, pelaksanaan, tanggal_dibuat
    ) 
    VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $8)
    RETURNING *
  `, [
    mahasiswaId,
    dosbing1Id,
    dosbing2Id,
    dosenPengujiId,
    jadwalId,
    namaSurat,
    // parameter ke-7 (path_file) diisi NULL langsung di query
    pelaksanaan,
    tanggalDibuat
  ]);

  return rows[0];
};

//
// 🔄 5️⃣ Update status diterbitkan (Manual Toggle jika perlu)
//
const updateStatusSurat = async (suratId, isDiterbitkan = true) => {
  const { rows } = await pool.query(`
    UPDATE surat 
    SET is_diterbitkan = $1 
    WHERE id = $2 
    RETURNING *
  `, [isDiterbitkan, suratId]);

  return rows[0];
};

//
// 🚀 6️⃣ Upload Surat Final (TTD)
// Fungsi ini dipanggil setelah admin upload file scan
//
const uploadSuratFinal = async (npm, relativePath, editorId) => { // Tambahkan editorId
  const query = `
    UPDATE surat
    SET path_file = $1, 
        is_diterbitkan = TRUE,
        is_edited = TRUE, 
        edited_by = $3, -- Masukkan ID Admin yang upload
        edited_at = CURRENT_TIMESTAMP
    WHERE mahasiswa_id = (SELECT id FROM mahasiswa WHERE npm = $2)
    RETURNING *
  `;
  const { rows } = await pool.query(query, [relativePath, npm, editorId]);
  return rows[0];
};

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
  
  // Kita return data lama buat dihapus fisiknya di controller
  const { rows } = await pool.query(query, [npm]);
  return rows[0];
};

module.exports = {
  formatTanggalIndonesia,
  getKaprodi,
  getMahasiswaBelumSurat,
  getSuratByMahasiswa,
  insertSurat,
  updateStatusSurat,
  uploadSuratFinal,
  deleteSuratFile
};