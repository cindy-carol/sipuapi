const pool = require('../config/db');

const Verifikasi = {
  // =========================
  // 1. Verifikasi Berkas (DISTINCT ON NPM)
  // =========================
  verifBerkas: async (tahunId = null) => {
    const params = [];
    // 🔥 Pake DISTINCT ON (m.npm) biar satu mahasiswa cuma muncul sekali
    let query = `
      SELECT DISTINCT ON (m.npm)
        m.id AS mahasiswa_id, m.id, m.nama, m.npm, t.nama_tahun, t.semester,
        COUNT(bu.berkas_id) AS total_berkas,
        SUM(CASE WHEN bu.status_verifikasi = TRUE THEN 1 ELSE 0 END) AS total_verif_true
      FROM mahasiswa m
      JOIN akun a ON m.akun_id = a.id   -- 🔥 JOIN AKUN
      LEFT JOIN tahun_ajaran t ON t.id = m.tahun_ajaran_id
      LEFT JOIN daftar_ujian du ON du.mahasiswa_id = m.id
      LEFT JOIN berkas_ujian bu ON bu.daftar_ujian_id = du.id
      
      WHERE a.status_aktif = TRUE       -- 🔥 FILTER AKTIF
    `;
    
    if (tahunId) {
      query += ` AND m.tahun_ajaran_id = $1`;
      params.push(tahunId);
    }

    query += `
      GROUP BY m.id, m.nama, m.npm, t.nama_tahun, t.semester, a.id
      HAVING SUM(CASE WHEN bu.status_verifikasi = TRUE THEN 1 ELSE 0 END) < COUNT(bu.berkas_id)
      ORDER BY m.npm ASC; -- 🔥 Wajib urut NPM dulu kalo pake DISTINCT ON
    `;
    const result = await pool.query(query, params);
    return result.rows;
  },

  // =========================
  // 2. Verifikasi Jadwal (DISTINCT ON NPM)
  // =========================
  verifJadwal: async (tahunId = null) => {
    const params = [];
    // 🔥 Pake DISTINCT ON (m.npm) biar gak muncul berkali-kali kalo join dosen banyak
    let query = `
      SELECT DISTINCT ON (m.npm)
        m.id AS mahasiswa_id,
        m.nama,
        m.npm,
        t.nama_tahun,
        t.semester,
        
        d1.nama AS dosbing1,
        d2.nama AS dosbing2,
        
        j.id AS jadwal_id,
        j.mahasiswa_id,
        j.tanggal,
        j.jam_mulai,
        j.jam_selesai,
        j.pelaksanaan,
        j.tempat,
        j.status_verifikasi,
        du.id AS daftar_ujian_id,
        du.status_keseluruhan,
        dp.id AS dosen_penguji_id
      FROM mahasiswa m
      JOIN akun a ON m.akun_id = a.id    -- 🔥 JOIN AKUN
      LEFT JOIN tahun_ajaran t ON t.id = m.tahun_ajaran_id
      
      LEFT JOIN dosen d1 ON d1.id = m.dosbing1_id
      LEFT JOIN dosen d2 ON d2.id = m.dosbing2_id
      
      LEFT JOIN jadwal j ON j.mahasiswa_id = m.id
      LEFT JOIN daftar_ujian du ON du.jadwal_id = j.id
      LEFT JOIN dosen_penguji dp ON dp.mahasiswa_id = m.id AND dp.id = du.dosen_penguji_id
      
      WHERE j.status_verifikasi = FALSE
      AND a.status_aktif = TRUE          
    `;

    if (tahunId) {
      params.push(tahunId);
      query += ` AND m.tahun_ajaran_id = $${params.length}`;
    }

    // 🔥 Urutkan berdasarkan NPM dulu (syarat DISTINCT ON), baru tanggal terbaru
    query += ` ORDER BY m.npm ASC, j.tanggal DESC NULLS LAST;`;

    const result = await pool.query(query, params);

    return result.rows.map(row => ({
      ...row,
      formattedJadwal: require('@utils/jadwalHelper')({
        tanggal: row.tanggal,
        jam_mulai: row.jam_mulai,
        jam_selesai: row.jam_selesai
      })
    }));
  },

  // =========================
  // 3. Update status verifikasi jadwal
  // =========================
  updateStatusVerifikasi: async (jadwalId, status, editorId) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(`
        UPDATE jadwal 
        SET status_verifikasi = $1, 
            is_edited = TRUE, 
            edited_by = $2, 
            edited_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [status, editorId, jadwalId]);

      const { rows } = await client.query(`SELECT mahasiswa_id FROM jadwal WHERE id = $1`, [jadwalId]);
      const mahasiswaId = rows[0]?.mahasiswa_id;
      if (!mahasiswaId) throw new Error('Mahasiswa tidak ditemukan.');

      const { rows: existing } = await client.query(`SELECT id FROM daftar_ujian WHERE jadwal_id = $1`, [jadwalId]);
      if (existing.length === 0) {
        await client.query(
          `INSERT INTO daftar_ujian (mahasiswa_id, jadwal_id, status_keseluruhan)
           VALUES ($1, $2, FALSE)`,
          [mahasiswaId, jadwalId]
        );
      }

      await client.query('COMMIT');
      return mahasiswaId;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // =========================
  // 4. Oper ke Kaprodi
  // =========================
  operKeKaprodi: async (mahasiswaId, kaprodiId = null, editorId = null) => { 
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: berkasCheck } = await client.query(`
        SELECT COUNT(*) FILTER (WHERE bu.status_verifikasi = FALSE) AS belum_verif
        FROM berkas_ujian bu JOIN daftar_ujian du ON bu.daftar_ujian_id = du.id WHERE du.mahasiswa_id = $1
      `, [mahasiswaId]);
      
      if (parseInt(berkasCheck[0].belum_verif, 10) > 0) throw new Error('Masih ada berkas yang belum diverifikasi.');

      const { rows: jadwalCheck } = await client.query(`SELECT id FROM jadwal WHERE mahasiswa_id = $1`, [mahasiswaId]);
      if (jadwalCheck.length === 0) throw new Error('Mahasiswa belum memiliki jadwal ujian.');
      
      const jadwalId = jadwalCheck[0].id;

      await client.query(`
        UPDATE jadwal 
        SET status_verifikasi = TRUE, is_edited = TRUE, edited_by = $2, edited_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [jadwalId, editorId]); 

      const { rows: duRows } = await client.query(`SELECT id FROM daftar_ujian WHERE mahasiswa_id = $1`, [mahasiswaId]);
      let daftarUjianId;
      if (duRows.length === 0) {
        const insertDU = await client.query(`
          INSERT INTO daftar_ujian (mahasiswa_id, jadwal_id, status_keseluruhan) VALUES ($1, $2, FALSE) RETURNING id
        `, [mahasiswaId, jadwalId]);
        daftarUjianId = insertDU.rows[0].id;
      } else {
        daftarUjianId = duRows[0].id;
        await client.query(`UPDATE daftar_ujian SET jadwal_id = $1 WHERE id = $2`, [jadwalId, daftarUjianId]);
      }

      const { rows: dpExisting } = await client.query(`SELECT id FROM dosen_penguji WHERE mahasiswa_id = $1 LIMIT 1`, [mahasiswaId]);
      let dosenPengujiId; 
      if (dpExisting.length > 0) {
        dosenPengujiId = dpExisting[0].id;
      } else {
        const insertDP = await client.query(`
          INSERT INTO dosen_penguji (kaprodi_id, mahasiswa_id, dosen_id, status_verifikasi, updated_by, tanggal_penunjukan)
          VALUES ($1, $2, NULL, FALSE, $3, NOW()) RETURNING id
        `, [kaprodiId, mahasiswaId, editorId]);
        dosenPengujiId = insertDP.rows[0].id;
      }

      await client.query(`UPDATE daftar_ujian SET dosen_penguji_id = $1 WHERE id = $2`, [dosenPengujiId, daftarUjianId]);

      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // =========================
  // 5. Surat & Selesai ujian (DISTINCT ON NPM)
  // =========================
// =========================
  // 5. Surat & Selesai ujian (DISTINCT ON NPM)
  // =========================
// models/verifikasiModel.js

  suratUndangan: async (tahunId = null) => {
    const params = [];
    let query = `
      SELECT DISTINCT ON (m.npm)
        m.id, m.nama, m.npm, t.nama_tahun, t.semester,
        s.id, s.nama_surat, s.path_file, s.is_diterbitkan, s.last_download_at,
        j.tanggal, j.jam_mulai, j.tempat,
        d1.nama AS dosbing1, d2.nama AS dosbing2, d3.nama AS penguji, dp.dosen_id AS dosen_penguji_id,
        BOOL_AND(dp.status_verifikasi) AS penguji_terverifikasi,
        BOOL_AND(bu.status_verifikasi) AS berkas_terverifikasi
      FROM mahasiswa m
      JOIN akun a ON m.akun_id = a.id   
      LEFT JOIN tahun_ajaran t ON t.id = m.tahun_ajaran_id
      LEFT JOIN surat s ON s.mahasiswa_id = m.id
      LEFT JOIN jadwal j ON j.mahasiswa_id = m.id
      LEFT JOIN dosen_penguji dp ON dp.mahasiswa_id = m.id
      LEFT JOIN daftar_ujian du ON du.mahasiswa_id = m.id AND du.dosen_penguji_id = dp.id
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
      GROUP BY 
        m.id, m.nama, m.npm, t.nama_tahun, t.semester, 
        s.id, s.nama_surat, s.path_file, s.is_diterbitkan, 
        s.last_download_at,
        j.tanggal, j.jam_mulai, j.tempat, du.ujian_selesai, d1.nama, d2.nama, d3.nama, dp.dosen_id
      HAVING 
        BOOL_AND(dp.status_verifikasi) = TRUE AND
        BOOL_AND(bu.status_verifikasi) = TRUE AND
        s.id IS NOT NULL AND
        du.ujian_selesai = FALSE
      ORDER BY m.npm ASC; 
    `;

    const result = await pool.query(query, params);
    
    // 🔥 UPDATE 3: MAPPING RETURN
    return result.rows.map(row => ({
      id: row.id, 
      nama: row.nama, 
      npm: row.npm, 
      nama_tahun: row.nama_tahun, 
      semester: row.semester,
      nama_surat: row.nama_surat, 
      path_file: row.path_file, 
      is_diterbitkan: row.is_diterbitkan,
      last_download_at: row.last_download_at,

      jadwal: { 
          tanggal: row.tanggal, 
          jam_mulai: row.jam_mulai, 
          pelaksanaan: row.tempat?.toLowerCase().includes('zoom') ? 'Online' : 'Offline', 
          tempat: row.tempat 
      },
      dosbing1: row.dosbing1 || '-', 
      dosbing2: row.dosbing2 || '-', 
      penguji: [row.penguji || '-']
    }));
  },

  // =========================
  // Helper functions
  // =========================
  getDetailJadwal: async (jadwalId) => {
    const query = `SELECT id, tanggal, jam_mulai, jam_selesai, pelaksanaan, tempat, link_zoom, meeting_id, passcode FROM jadwal WHERE id = $1`;
    const result = await pool.query(query, [jadwalId]);
    return result.rows[0];
  },

  updateJadwal: async (jadwalId, data) => {
    const { tanggal, jam_mulai, jam_selesai, pelaksanaan, tempat, link_zoom, meeting_id, passcode, editorId } = data;
    const query = `
      UPDATE jadwal 
      SET tanggal = $1, jam_mulai = $2, jam_selesai = $3, pelaksanaan = $4, tempat = $5,
          link_zoom = $6, meeting_id = $7, passcode = $8,
          is_edited = TRUE, edited_by = $9, edited_at = CURRENT_TIMESTAMP
      WHERE id = $10 RETURNING *
    `;
    const values = [tanggal, jam_mulai, jam_selesai, pelaksanaan, tempat, link_zoom, meeting_id, passcode, editorId, jadwalId];
    const result = await pool.query(query, values);
    return result.rows[0];
  },

  getAllDosen: async () => {
    const query = `SELECT id, nama, kode_dosen FROM dosen WHERE status_aktif = TRUE ORDER BY nama ASC`;
    const result = await pool.query(query);
    return result.rows;
  },

  updateDosenPenguji: async (mahasiswaId, dosenPengujiId, editorId) => {
    const query = `
        UPDATE dosen_penguji 
        SET dosen_id = $1, status_verifikasi = TRUE, updated_by = $2, updated_at = NOW() 
        WHERE mahasiswa_id = $3
    `;
    await pool.query(query, [dosenPengujiId, editorId, mahasiswaId]);
  },

  updateTanggalSurat: async (mahasiswaId, date) => {
    await pool.query('UPDATE surat SET tanggal_dibuat = $1 WHERE mahasiswa_id = $2', [date, mahasiswaId]);
  },

  // ... (fungsi lain) ...

  // 🔥 1. FUNGSI UPDATE STATUS SAAT JADWAL BERUBAH
  // Dipanggil pas Admin simpan edit jadwal/surat
// models/verifikasiModel.js

// 🔥 UBAH NAMA dari incrementRevisiSurat jadi resetStatusSurat
resetStatusSurat: async (mahasiswaId, editorId) => {
  // Logic: 
  // 1. File lama dihapus (path_file = NULL) biar mhs gak download surat salah
  // 2. is_diterbitkan jadi FALSE (balik jadi draft)
  // 3. Catat SIAPA yang edit (edited_by) tanpa ada kolom revisi_ke
  const query = `
    UPDATE surat 
    SET last_download_at = NULL, 
        path_file = NULL,
        is_edited = TRUE,
        is_diterbitkan = FALSE, 
        tanggal_dibuat = NOW(),
        edited_by = $2,
        edited_at = NOW()
    WHERE mahasiswa_id = $1
  `;
  await pool.query(query, [mahasiswaId, editorId]);
},

  // 🔥 2. FUNGSI UPDATE STATUS SAAT KLIK DOWNLOAD
  // Dipanggil pas Admin klik tombol download
  markSuratDownloaded: async (npm) => {
    // Logic: Isi last_download_at biar Dot Merah HILANG
    const query = `
      UPDATE surat 
      SET last_download_at = NOW() 
      WHERE mahasiswa_id = (SELECT id FROM mahasiswa WHERE npm = $1)
    `;
    await pool.query(query, [npm]);
  },

  // =========================
  // 6. Action List: TANDAI SELESAI (Crosscheck)
  // =========================
  selesaiUjian: async (tahunId = null) => {
    const params = [];
    
    // 🔥 Pake DISTINCT ON (m.npm)
    let query = `
      SELECT DISTINCT ON (m.npm)
        m.id AS mahasiswa_id, m.id, m.nama, m.npm, t.nama_tahun, t.semester,
        j.tanggal, j.jam_mulai, j.jam_selesai, j.tempat, j.pelaksanaan,
        d1.nama AS dosbing1,
        d2.nama AS dosbing2,
        du.status_keseluruhan,
        du.tanggal_selesai
      FROM mahasiswa m
      JOIN akun a ON m.akun_id = a.id   
      LEFT JOIN tahun_ajaran t ON t.id = m.tahun_ajaran_id
      LEFT JOIN daftar_ujian du ON du.mahasiswa_id = m.id
      
      -- Join detail biar admin bisa crosscheck
      LEFT JOIN jadwal j ON j.mahasiswa_id = m.id
      LEFT JOIN dosen_penguji dp ON dp.mahasiswa_id = m.id
      LEFT JOIN berkas_ujian bu ON bu.daftar_ujian_id = du.id
      LEFT JOIN surat s ON s.mahasiswa_id = m.id
      LEFT JOIN dosen d1 ON d1.id = m.dosbing1_id
      LEFT JOIN dosen d2 ON d2.id = m.dosbing2_id
      
      WHERE a.status_aktif = TRUE
    `;

    if (tahunId) {
      query += ` AND m.tahun_ajaran_id = $1`;
      params.push(tahunId);
    }

    // 🔥 FIX: Masukkan SEMUA kolom non-agregat ke GROUP BY
    query += `
      GROUP BY 
        m.id, m.nama, m.npm, t.nama_tahun, t.semester, 
        j.id, j.tanggal, j.jam_mulai, j.jam_selesai, j.tempat, j.pelaksanaan,
        du.id, du.status_keseluruhan, du.tanggal_selesai,
        d1.nama, d2.nama,
        s.id 
      HAVING 
        BOOL_AND(dp.status_verifikasi) = TRUE AND
        BOOL_AND(bu.status_verifikasi) = TRUE AND
        s.id IS NOT NULL AND
        (du.status_keseluruhan IS NULL OR du.status_keseluruhan = FALSE) AND
        
        -- 🔥 HANYA MUNCUL SETELAH UJIAN SELESAI
        (j.tanggal + j.jam_selesai) < NOW()

      ORDER BY m.npm ASC;
    `;

    const result = await pool.query(query, params);
    return result.rows;
  },

  // =========================
  // 7. Proses Tandai Selesai (FIX Boolean)
  // =========================
  tandaiSelesai: async (mahasiswaId, editorId) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Validasi ulang (Just in case)
      const { rows: berkas } = await client.query(`SELECT COUNT(*) FILTER (WHERE status_verifikasi = FALSE) AS belum_verif FROM berkas_ujian bu JOIN daftar_ujian du ON bu.daftar_ujian_id = du.id WHERE du.mahasiswa_id = $1`, [mahasiswaId]);
      if (parseInt(berkas[0].belum_verif) > 0) throw new Error("Masih ada berkas yang belum diverifikasi.");

      const { rows: jadwal } = await client.query(`SELECT status_verifikasi FROM jadwal WHERE mahasiswa_id = $1`, [mahasiswaId]);
      if (jadwal.length === 0) throw new Error("Mahasiswa belum memiliki jadwal.");
      if (!jadwal[0].status_verifikasi) throw new Error("Jadwal belum diverifikasi admin.");

      // Set Surat Diterbitkan
      await client.query(`UPDATE surat SET is_diterbitkan = TRUE WHERE mahasiswa_id = $1`, [mahasiswaId]);

      // 🔥 UPDATE KE TRUE (BOOLEAN)
      await client.query(`
        UPDATE daftar_ujian
        SET ujian_selesai = TRUE, 
            status_keseluruhan = TRUE, 
            tanggal_selesai = NOW()
        WHERE mahasiswa_id = $1
      `, [mahasiswaId]);

      // Nonaktifkan Akun
      const result = await client.query(`SELECT npm FROM mahasiswa WHERE id = $1`, [mahasiswaId]);
      const npm = result.rows[0]?.npm;
      if (!npm) throw new Error("NPM mahasiswa tidak ditemukan.");

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

  updateStatusBerkas: async (berkasId, status) => {
    const query = `UPDATE berkas_ujian SET status_verifikasi = $1 WHERE id = $2`;
    await pool.query(query, [status, berkasId]);
  }
};

module.exports = Verifikasi;