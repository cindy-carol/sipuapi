const pool = require('@config/db.js');

const getMahasiswaBelumPenguji = async () => {
  // Menggunakan DISTINCT ON agar satu NPM hanya muncul satu kali di antrean
  let query = `
    SELECT DISTINCT ON (m.npm)
      m.id AS mahasiswa_id,
      m.npm,
      m.nama,
      t.nama_tahun,
      t.semester,
      d.nama AS dosen_pembimbing,
      dp.id AS dosen_penguji_id,
      dp.status_verifikasi AS status_penguji,
      j.status_verifikasi AS jadwal_verifikasi
    FROM mahasiswa m
    JOIN tahun_ajaran t ON t.id = m.tahun_ajaran_id
    JOIN daftar_ujian du ON du.mahasiswa_id = m.id
    JOIN jadwal j ON j.id = du.jadwal_id
    LEFT JOIN dosen_penguji dp ON dp.mahasiswa_id = m.id
    LEFT JOIN dosen d ON dp.dosen_id = d.id
    WHERE j.status_verifikasi = TRUE 
      AND (dp.id IS NULL OR dp.status_verifikasi = FALSE)
    ORDER BY m.npm, t.nama_tahun ASC 
  `;

  const { rows } = await pool.query(query);
  return rows;
};

const getMahasiswaSudahPenguji = async (tahunId = null) => {
  const params = [];
  let query = `
    SELECT m.npm, m.nama, d.nama AS dosen
    FROM mahasiswa m
    JOIN dosen_penguji p ON m.id = p.mahasiswa_id
    JOIN dosen d ON p.dosen_id = d.id
  `;
  if (tahunId) {
    query += ` WHERE m.tahun_ajaran_id = $1`;
    params.push(tahunId);
  }
  query += ` ORDER BY m.npm`;
  const { rows } = await pool.query(query, params);
  return rows;
};

const getAllDosen = async () => {
  const result = await pool.query(`SELECT id, kode_dosen, nama FROM dosen ORDER BY id ASC`);
  return result.rows;
};

const getMahasiswaByNPM = async (npm) => {
  const result = await pool.query(`
    SELECT m.id, m.npm, m.nama, m.tahun_ajaran_id AS tahun_ajaran,
           m.dosbing1_id, m.dosbing2_id,
           d1.nama AS dosbing1, d2.nama AS dosbing2,
           j.tanggal, j.jam_mulai, j.jam_selesai, j.tempat, j.pelaksanaan
    FROM mahasiswa m
    LEFT JOIN dosen d1 ON m.dosbing1_id = d1.id
    LEFT JOIN dosen d2 ON m.dosbing2_id = d2.id
    LEFT JOIN jadwal j ON j.mahasiswa_id = m.id
    WHERE m.npm = $1
  `, [npm]);
  return result.rows[0];
};

// =========================================================
// 🔥 VERSI AMAN: ASSIGN PENGUJI (Tanpa error Updated_At)
// =========================================================
const assignPenguji = async (npm, dosenIds, kaprodiId, editorId) => {
  const client = await pool.connect(); 
  try {
    await client.query('BEGIN');

    // 1. Ambil ID Mahasiswa
    const { rows } = await client.query(`SELECT id FROM mahasiswa WHERE npm = $1`, [npm]);
    if (!rows[0]) throw new Error('Mahasiswa tidak ditemukan');
    const mahasiswaId = rows[0].id;

    // 2. Cek Penguji Lama
    const { rows: pengujiLama } = await client.query(
      `SELECT id FROM dosen_penguji WHERE mahasiswa_id = $1 ORDER BY id`,
      [mahasiswaId]
    );

    // 3. Loop Assign
    for (let i = 0; i < dosenIds.length; i++) {
      const dosenId = dosenIds[i];
      
      if (pengujiLama[i]) {
        // UPDATE
        await client.query(
          `UPDATE dosen_penguji 
           SET dosen_id = $1, status_verifikasi = TRUE, kaprodi_id = $3, updated_by = $4, updated_at = NOW()
           WHERE id = $2`,
          [dosenId, pengujiLama[i].id, kaprodiId, editorId]
        );
      } else {
        // INSERT
        await client.query(
          `INSERT INTO dosen_penguji (mahasiswa_id, dosen_id, status_verifikasi, kaprodi_id, updated_by, created_at, updated_at)
           VALUES ($1, $2, TRUE, $3, $4, NOW(), NOW())`, 
          [mahasiswaId, dosenId, kaprodiId, editorId]
        );
      }
    }

    // ===========================================================
    // 🔥 SYNC DAFTAR UJIAN (VERSI AMAN - Hapus updated_at)
    // ===========================================================
    const { rows: dpBaru } = await client.query(
        `SELECT id FROM dosen_penguji WHERE mahasiswa_id = $1 ORDER BY id DESC LIMIT 1`,
        [mahasiswaId]
    );

    if (dpBaru.length > 0) {
        const dpId = dpBaru[0].id;
        // Update kolom dosen_penguji_id SAJA (Gak usah update timestamp dulu biar ga error)
        await client.query(
            `UPDATE daftar_ujian SET dosen_penguji_id = $1 WHERE mahasiswa_id = $2`,
            [dpId, mahasiswaId]
        );
    }
    // ===========================================================

    // 4. Logic Surat Otomatis
    const { rows: cekPenguji } = await client.query(
      `SELECT COUNT(*) AS belum FROM dosen_penguji WHERE mahasiswa_id = $1 AND status_verifikasi = FALSE`,
      [mahasiswaId]
    );

    if (parseInt(cekPenguji[0].belum, 10) === 0) {
      // a. Ambil Jadwal
      const { rows: jadwalRows } = await client.query(
        `SELECT id, pelaksanaan FROM jadwal WHERE mahasiswa_id = $1`, [mahasiswaId]
      );
      
      if (jadwalRows.length > 0) {
          const jadwalId = jadwalRows[0].id;
          const pelaksanaan = jadwalRows[0].pelaksanaan || 'offline'; 
          const dosenPengujiId = dpBaru[0]?.id; 

          // b. Ambil Dosbing
          const mahasiswaData = await client.query(
            `SELECT dosbing1_id, dosbing2_id FROM mahasiswa WHERE id = $1`, [mahasiswaId]
          );
          const { dosbing1_id, dosbing2_id } = mahasiswaData.rows[0];

          // c. Cek/Insert Surat
          const cekSurat = await client.query(`SELECT id FROM surat WHERE mahasiswa_id = $1`, [mahasiswaId]);

          let suratId;
          if (cekSurat.rows.length === 0) {
              const { rows: suratRows } = await client.query(
                `INSERT INTO surat (mahasiswa_id, dosbing1_id, dosbing2_id, dosen_penguji_id, jadwal_id, nama_surat, pelaksanaan, tanggal_dibuat)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP) RETURNING id`,
                [mahasiswaId, dosbing1_id, dosbing2_id, dosenPengujiId, jadwalId, 'Surat Undangan Ujian (Draft)', pelaksanaan]
              );
              suratId = suratRows[0].id;
          } else {
              suratId = cekSurat.rows[0].id;
              await client.query(
                  `UPDATE surat SET dosen_penguji_id = $1, jadwal_id = $2 WHERE id = $3`,
                  [dosenPengujiId, jadwalId, suratId]
              );
          }

          // d. Update Link Surat
          await client.query(
            `UPDATE daftar_ujian SET surat_id = $1 WHERE mahasiswa_id = $2`,
            [suratId, mahasiswaId]
          );
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err; // Lempar error biar ditangkep controller
  } finally {
    client.release();
  }
};

// ... (getJadwalDosen TETAP SAMA KAYA YANG LAMA) ...
const getJadwalDosen = async (tanggal, jamMulai, jamSelesai, excludeMahasiswaId) => {
  const query = `
    SELECT DISTINCT id FROM (
        SELECT dp.dosen_id AS id FROM dosen_penguji dp JOIN jadwal j ON dp.mahasiswa_id = j.mahasiswa_id WHERE j.tanggal = $1 AND j.jam_mulai < $3 AND j.jam_selesai > $2 AND j.mahasiswa_id != $4
        UNION
        SELECT m.dosbing1_id AS id FROM mahasiswa m JOIN jadwal j ON m.id = j.mahasiswa_id WHERE j.tanggal = $1 AND j.jam_mulai < $3 AND j.jam_selesai > $2 AND j.mahasiswa_id != $4
        UNION
        SELECT m.dosbing2_id AS id FROM mahasiswa m JOIN jadwal j ON m.id = j.mahasiswa_id WHERE j.tanggal = $1 AND j.jam_mulai < $3 AND j.jam_selesai > $2 AND j.mahasiswa_id != $4
    ) AS sibuk
  `;
  const result = await pool.query(query, [tanggal, jamMulai, jamSelesai, excludeMahasiswaId]);
  return result.rows.map(row => row.id);
};

module.exports = {
  getMahasiswaBelumPenguji,
  getMahasiswaSudahPenguji,
  getAllDosen,
  getMahasiswaByNPM,
  assignPenguji,
  getJadwalDosen
};