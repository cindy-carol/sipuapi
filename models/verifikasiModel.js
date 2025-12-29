// models/verifikasiModel.js
const pool = require('../config/db');

/**
 * ============================================================
 * 🛡️ MODEL: VERIFIKASI & WORKFLOW (ADMIN & KAPRODI)
 * ============================================================
 */
const Verifikasi = {

  // 1️⃣ Verifikasi Berkas (Antrean Mahasiswa dengan Berkas Belum Lengkap/Verif)
  verifBerkas: async (tahunId = null) => {
    const params = [];
    let query = `
      SELECT DISTINCT ON (m.npm)
        m.id AS mahasiswa_id, m.nama, m.npm, t.nama_tahun, t.semester,
        COUNT(bu.berkas_id) AS total_berkas,
        SUM(CASE WHEN bu.status_verifikasi = TRUE THEN 1 ELSE 0 END) AS total_verif_true
      FROM mahasiswa m
      JOIN akun a ON m.akun_id = a.id
      LEFT JOIN tahun_ajaran t ON t.id = m.tahun_ajaran_id
      LEFT JOIN daftar_ujian du ON du.mahasiswa_id = m.id
      LEFT JOIN berkas_ujian bu ON bu.daftar_ujian_id = du.id
      WHERE a.status_aktif = TRUE 
    `;
    
    if (tahunId) {
      query += ` AND m.tahun_ajaran_id = $1`;
      params.push(tahunId);
    }

    query += `
      GROUP BY m.id, m.nama, m.npm, t.nama_tahun, t.semester, a.id
      HAVING SUM(CASE WHEN bu.status_verifikasi = TRUE THEN 1 ELSE 0 END) < COUNT(bu.berkas_id)
      ORDER BY m.npm ASC;
    `;
    const result = await pool.query(query, params);
    return result.rows;
  },

  // 2️⃣ Verifikasi Jadwal (Antrean Mahasiswa dengan Jadwal Baru/Revisi)
  verifJadwal: async (tahunId = null) => {
    const params = [];
    let query = `
      SELECT DISTINCT ON (m.npm)
        m.id AS mahasiswa_id, m.nama, m.npm, t.nama_tahun, t.semester,
        d1.nama AS dosbing1, d2.nama AS dosbing2,
        j.id AS jadwal_id, j.tanggal, j.jam_mulai, j.jam_selesai, j.pelaksanaan, j.tempat, j.status_verifikasi
      FROM mahasiswa m
      JOIN akun a ON m.akun_id = a.id
      LEFT JOIN tahun_ajaran t ON t.id = m.tahun_ajaran_id
      LEFT JOIN dosen d1 ON d1.id = m.dosbing1_id
      LEFT JOIN dosen d2 ON d2.id = m.dosbing2_id
      LEFT JOIN jadwal j ON j.mahasiswa_id = m.id
      WHERE j.status_verifikasi = FALSE AND a.status_aktif = TRUE 
    `;

    if (tahunId) {
      params.push(tahunId);
      query += ` AND m.tahun_ajaran_id = $${params.length}`;
    }

    query += ` ORDER BY m.npm ASC, j.tanggal DESC NULLS LAST;`;
    const result = await pool.query(query, params);
    return result.rows;
  },

  // 3️⃣ Update Status Verifikasi Jadwal & Sinkronisasi Daftar Ujian
  updateStatusVerifikasi: async (jadwalId, status, editorId) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        UPDATE jadwal 
        SET status_verifikasi = $1, is_edited = TRUE, edited_by = $2, edited_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [status, editorId, jadwalId]);

      const { rows } = await client.query(`SELECT mahasiswa_id FROM jadwal WHERE id = $1`, [jadwalId]);
      const mahasiswaId = rows[0]?.mahasiswa_id;
      if (!mahasiswaId) throw new Error('Mahasiswa tidak ditemukan.');

      await client.query(`
        INSERT INTO daftar_ujian (mahasiswa_id, jadwal_id, status_keseluruhan)
        VALUES ($1, $2, FALSE)
        ON CONFLICT (mahasiswa_id) DO UPDATE SET jadwal_id = EXCLUDED.jadwal_id
      `, [mahasiswaId, jadwalId]);

      await client.query('COMMIT');
      return mahasiswaId;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // 4️⃣ Oper ke Kaprodi (Final Check Berkas + Jadwal)
  operKeKaprodi: async (mahasiswaId, kaprodiId = null, editorId = null) => { 
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: berkasCheck } = await client.query(`
        SELECT COUNT(*) FILTER (WHERE bu.status_verifikasi = FALSE) AS belum_verif
        FROM berkas_ujian bu JOIN daftar_ujian du ON bu.daftar_ujian_id = du.id WHERE du.mahasiswa_id = $1
      `, [mahasiswaId]);
      if (parseInt(berkasCheck[0].belum_verif, 10) > 0) throw new Error('Berkas belum diverifikasi.');

      const { rows: jadwalCheck } = await client.query(`SELECT id FROM jadwal WHERE mahasiswa_id = $1`, [mahasiswaId]);
      if (jadwalCheck.length === 0) throw new Error('Jadwal belum ada.');
      
      const jadwalId = jadwalCheck[0].id;
      await client.query(`UPDATE jadwal SET status_verifikasi = TRUE, edited_by = $2 WHERE id = $1`, [jadwalId, editorId]); 

      await client.query(`
        INSERT INTO dosen_penguji (kaprodi_id, mahasiswa_id, dosen_id, status_verifikasi, updated_by, tanggal_penunjukan)
        VALUES ($1, $2, NULL, FALSE, $3, NOW())
        ON CONFLICT (mahasiswa_id) DO NOTHING
      `, [kaprodiId, mahasiswaId, editorId]);

      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // 5️⃣ List Surat Undangan (Hanya yang Siap Download/Terbit)
  suratUndangan: async (tahunId = null) => {
    const params = [];
    let query = `
      SELECT DISTINCT ON (m.npm)
        m.id, m.nama, m.npm, t.nama_tahun, t.semester,
        s.id AS surat_id, s.nama_surat, s.path_file, s.is_diterbitkan, s.last_download_at,
        j.tanggal, j.jam_mulai, j.tempat,
        d1.nama AS dosbing1, d2.nama AS dosbing2, d3.nama AS penguji
      FROM mahasiswa m
      JOIN akun a ON m.akun_id = a.id
      LEFT JOIN tahun_ajaran t ON t.id = m.tahun_ajaran_id
      LEFT JOIN surat s ON s.mahasiswa_id = m.id
      LEFT JOIN jadwal j ON j.mahasiswa_id = m.id
      LEFT JOIN dosen_penguji dp ON dp.mahasiswa_id = m.id
      LEFT JOIN daftar_ujian du ON du.mahasiswa_id = m.id
      LEFT JOIN berkas_ujian bu ON bu.daftar_ujian_id = du.id
      LEFT JOIN dosen d1 ON d1.id = m.dosbing1_id
      LEFT JOIN dosen d2 ON d2.id = m.dosbing2_id
      LEFT JOIN dosen d3 ON d3.id = dp.dosen_id
      WHERE a.status_aktif = TRUE
    `;

    if (tahunId) {
      query += ` AND m.tahun_ajaran_id = $1`;
      params.push(tahunId);
    }

    query += `
      GROUP BY m.id, m.nama, m.npm, t.nama_tahun, t.semester, s.id, j.tanggal, j.jam_mulai, j.tempat, du.ujian_selesai, d1.nama, d2.nama, d3.nama, dp.dosen_id
      HAVING BOOL_AND(dp.status_verifikasi) = TRUE AND BOOL_AND(bu.status_verifikasi) = TRUE AND s.id IS NOT NULL AND du.ujian_selesai = FALSE
      ORDER BY m.npm ASC; 
    `;
    const result = await pool.query(query, params);
    return result.rows;
  },

  // 6️⃣ Tandai Selesai (Final Step: Nonaktifkan Akun Mahasiswa)
  tandaiSelesai: async (mahasiswaId, editorId) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        UPDATE daftar_ujian SET ujian_selesai = TRUE, status_keseluruhan = TRUE, tanggal_selesai = NOW()
        WHERE mahasiswa_id = $1
      `, [mahasiswaId]);

      const result = await client.query(`SELECT npm FROM mahasiswa WHERE id = $1`, [mahasiswaId]);
      const npm = result.rows[0]?.npm;
      await client.query(`UPDATE akun SET status_aktif = FALSE WHERE username = $1 AND role = 'mahasiswa'`, [npm]);

      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // 7️⃣ Action List: Mahasiswa Siap Selesai (Cek Waktu NOW())
  selesaiUjian: async (tahunId = null) => {
    const params = [];
    let query = `
      SELECT DISTINCT ON (m.npm)
        m.id AS mahasiswa_id, m.nama, m.npm, t.nama_tahun, t.semester,
        j.tanggal, j.jam_mulai, j.jam_selesai,
        du.status_keseluruhan
      FROM mahasiswa m
      JOIN akun a ON m.akun_id = a.id
      LEFT JOIN tahun_ajaran t ON t.id = m.tahun_ajaran_id
      LEFT JOIN daftar_ujian du ON du.mahasiswa_id = m.id
      LEFT JOIN jadwal j ON j.mahasiswa_id = m.id
      LEFT JOIN dosen_penguji dp ON dp.mahasiswa_id = m.id
      LEFT JOIN berkas_ujian bu ON bu.daftar_ujian_id = du.id
      LEFT JOIN surat s ON s.mahasiswa_id = m.id
      WHERE a.status_aktif = TRUE
    `;

    if (tahunId) {
      query += ` AND m.tahun_ajaran_id = $1`;
      params.push(tahunId);
    }

    query += `
      GROUP BY m.id, m.nama, m.npm, t.nama_tahun, t.semester, j.id, du.id, s.id
      HAVING BOOL_AND(dp.status_verifikasi) = TRUE AND BOOL_AND(bu.status_verifikasi) = TRUE 
      AND s.id IS NOT NULL AND (du.status_keseluruhan IS NULL OR du.status_keseluruhan = FALSE) 
      AND (j.tanggal + j.jam_selesai) < NOW()
      ORDER BY m.npm ASC;
    `;
    const result = await pool.query(query, params);
    return result.rows;
  },

  // 🛠️ Utility Functions
  resetStatusSurat: async (mahasiswaId, editorId) => {
    const query = `
      UPDATE surat SET last_download_at = NULL, path_file = NULL, is_diterbitkan = FALSE, 
      tanggal_dibuat = NOW(), edited_by = $2, edited_at = NOW() WHERE mahasiswa_id = $1
    `;
    await pool.query(query, [mahasiswaId, editorId]);
  },

  markSuratDownloaded: async (npm) => {
    await pool.query(`UPDATE surat SET last_download_at = NOW() WHERE mahasiswa_id = (SELECT id FROM mahasiswa WHERE npm = $1)`, [npm]);
  },

  getDetailJadwal: async (jadwalId) => {
    const result = await pool.query(`SELECT * FROM jadwal WHERE id = $1`, [jadwalId]);
    return result.rows[0];
  },

  updateStatusBerkas: async (berkasId, status) => {
    await pool.query(`UPDATE berkas_ujian SET status_verifikasi = $1 WHERE id = $2`, [status, berkasId]);
  }
};

module.exports = Verifikasi;