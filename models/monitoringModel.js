// models/monitoringModel.js
const pool = require('../config/db');

/**
 * ======================================================
 * 🔍 1. GET ALL MAHASISWA MONITORING
 * ======================================================
 * Fungsi utama untuk tabel monitoring Kaprodi/Admin.
 * Menggabungkan semua status pendaftaran dalam satu kueri.
 */
const getAllMahasiswaMonitoring = async (tahunAjaranFilter = null) => {
  let query = `
    SELECT
      m.id,
      m.npm,
      m.nama,
      m.tahun_ajaran_id AS tahun_ajaran,
      d1.nama AS dosbing1,
      d2.nama AS dosbing2,
      j.tanggal AS tanggal_jadwal,
      j.jam_mulai AS jam_mulai_jadwal,
      j.jam_selesai AS jam_selesai_jadwal,
      j.pelaksanaan AS pelaksanaan_jadwal,
      BOOL_AND(j.status_verifikasi) AS status_jadwal,
      MAX(b.nama_berkas) AS nama_berkas,
      BOOL_AND(bu.status_verifikasi) AS verif_berkas,
      BOOL_AND(p.status_verifikasi) AS status_penguji,
      
      -- 🔥 LOGIC SURAT: Hanya hitung surat yang sudah diterbitkan (Bukan Draft)
      COUNT(s.id) FILTER (WHERE s.is_diterbitkan = TRUE) AS jumlah_surat_valid,

      BOOL_AND(du.status_keseluruhan) AS sudah_ujian,
      ARRAY_AGG(DISTINCT d.nama) AS penguji_nama
    FROM mahasiswa m
    LEFT JOIN dosen d1 ON m.dosbing1_id = d1.id
    LEFT JOIN dosen d2 ON m.dosbing2_id = d2.id
    LEFT JOIN jadwal j ON j.mahasiswa_id = m.id
    LEFT JOIN berkas b ON b.mahasiswa_id = m.id
    LEFT JOIN berkas_ujian bu ON bu.berkas_id = b.id
    LEFT JOIN dosen_penguji p ON p.mahasiswa_id = m.id
    LEFT JOIN dosen d ON p.dosen_id = d.id
    LEFT JOIN surat s ON s.mahasiswa_id = m.id
    LEFT JOIN daftar_ujian du ON du.mahasiswa_id = m.id
  `;

  const params = [];
  if (tahunAjaranFilter) {
    query += ` WHERE m.tahun_ajaran_id = $1`;
    params.push(Number(tahunAjaranFilter));
  }

  query += `
    GROUP BY m.id, m.npm, m.nama, m.tahun_ajaran_id, d1.nama, d2.nama,
             j.tanggal, j.jam_mulai, j.jam_selesai, j.pelaksanaan
    ORDER BY m.npm
  `;

  const result = await pool.query(query, params);
  const rows = result.rows || [];

  return rows.map(row => {
    // Formatting tanggal dan waktu untuk tampilan tabel yang manusiawi
    const jadwalUjian = row.tanggal_jadwal && row.jam_mulai_jadwal && row.jam_selesai_jadwal
      ? `${new Date(row.tanggal_jadwal).toLocaleDateString('id-ID', {
           weekday: 'long',
           year: 'numeric',
           month: 'long',
           day: 'numeric'
         })} ${row.jam_mulai_jadwal.substring(0,5)} – ${row.jam_selesai_jadwal.substring(0,5)}${row.pelaksanaan_jadwal ? ` (${row.pelaksanaan_jadwal})` : ''}`
      : '-';

    return {
      npm: row.npm,
      nama: row.nama,
      tahunAjaran: row.tahun_ajaran || '-',
      dosbing: [row.dosbing1, row.dosbing2],
      uploadBerkas: !!row.nama_berkas,
      verifBerkas: !!row.verif_berkas,
      penguji: !!row.status_penguji,  
      pengujiNama: row.penguji_nama.filter(n => n), 
      suratUndangan: row.jumlah_surat_valid > 0, // Boolean true jika ada surat terbit
      sudahUjian: !!row.sudah_ujian,
      jadwalUjian,
      jadwalUjianDone: !!row.status_jadwal
    };
  });
};

/**
 * ======================================================
 * 📊 2. GET STATISTIK PER ANGKATAN
 * ======================================================
 */
const getStatistikPerAngkatan = async (tahunAjaranFilter = null) => {
  const semuaMahasiswa = await getAllMahasiswaMonitoring(tahunAjaranFilter);
  const statistik = {};
  semuaMahasiswa.forEach(mhs => {
    const angkatan = mhs.tahunAjaran;
    if (!statistik[angkatan]) statistik[angkatan] = 0;
    statistik[angkatan]++;
  });
  return Object.keys(statistik).map(angkatan => ({
    label: angkatan,
    jumlah: statistik[angkatan]
  }));
};

/**
 * ======================================================
 * ⚡ 3. GET QUICK VIEW STAT
 * ======================================================
 * Digunakan untuk dashboard penetapan penguji Kaprodi.
 */
const getQuickViewStat = async () => {
    try {
      const query = `
        SELECT 
          ta.id AS tahun_id,
          ta.nama_tahun,
          ta.semester,
          COUNT(m.id) FILTER (WHERE du.id IS NULL) AS belum,
          COUNT(m.id) FILTER (
            WHERE du.id IS NOT NULL 
            AND (dp.status_verifikasi IS NULL OR dp.status_verifikasi = FALSE)
          ) AS menunggu,
          COUNT(m.id) FILTER (WHERE dp.status_verifikasi = TRUE) AS dapat
        FROM tahun_ajaran ta
        LEFT JOIN mahasiswa m ON m.tahun_ajaran_id = ta.id
        LEFT JOIN akun a ON m.akun_id = a.id
        LEFT JOIN daftar_ujian du ON du.mahasiswa_id = m.id
        LEFT JOIN dosen_penguji dp ON du.dosen_penguji_id = dp.id
        WHERE a.status_aktif = true
        GROUP BY ta.id, ta.nama_tahun, ta.semester
        ORDER BY ta.nama_tahun DESC, ta.semester DESC
      `;
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      console.error("❌ Error getQuickViewStat:", error);
      return [];
    }
};

module.exports = { getAllMahasiswaMonitoring, getStatistikPerAngkatan, getQuickViewStat };