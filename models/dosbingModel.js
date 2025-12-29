// models/dosbingModel.js
const pool = require('../config/db');

/**
 * ============================================================
 * 👨‍🏫 MODEL: DOSEN PEMBIMBING (DOSBING)
 * ============================================================
 * Mengelola relasi bimbingan antara dosen dan mahasiswa, 
 * termasuk fitur rekapitulasi beban kerja dosen.
 */
const Dosbing = {

  // 🔹 1. Ambil daftar mahasiswa + dosbing (dengan kode_dosen), bisa filter per tahun
  getAll: async (tahunId = null) => {
    try {
      const params = [];
      let query = `
        SELECT 
          m.id,
          m.npm, 
          m.nama, 
          m.dosbing1_id,
          m.dosbing2_id,
          t.nama_tahun, 
          t.semester,
          d1.nama AS dosbing1,
          d1.kode_dosen AS kode_dosbing1,
          d2.nama AS dosbing2,
          d2.kode_dosen AS kode_dosbing2
        FROM mahasiswa m
        LEFT JOIN tahun_ajaran t ON m.tahun_ajaran_id = t.id
        LEFT JOIN dosen d1 ON m.dosbing1_id = d1.id
        LEFT JOIN dosen d2 ON m.dosbing2_id = d2.id
      `;

      if (tahunId) {
        query += ` WHERE m.tahun_ajaran_id = $1`;
        params.push(tahunId);
      }

      query += ` ORDER BY m.npm`;

      const result = await pool.query(query, params);
      return result.rows;
    } catch (err) {
      console.error('❌ ERROR getAll:', err);
      throw err;
    }
  },

  // 🔹 2. Ambil data mahasiswa → dosbing (Simple list)
  getMahasiswaKeDosen: async () => {
    const query = `
      SELECT 
        m.npm,
        m.nama,
        d1.nama AS dosbing1,
        d2.nama AS dosbing2
      FROM mahasiswa m
      LEFT JOIN dosen d1 ON m.dosbing1_id = d1.id
      LEFT JOIN dosen d2 ON m.dosbing2_id = d2.id
      ORDER BY m.npm;
    `;
    const result = await pool.query(query);
    return result.rows;
  },

  // 🔹 3. Ambil data dosen → mahasiswa bimbingan (FILTERED BY YEAR)
  // Digunakan untuk tab pemantauan beban kerja dosen
  getDosenKeMahasiswa: async (tahunId = null) => {
    try {
        const params = [];
        let filterClause = "";
        
        if (tahunId) {
            filterClause = " AND m.tahun_ajaran_id = $1";
            params.push(tahunId);
        }

        const query = `
          SELECT 
            d.id AS dosen_id,
            d.kode_dosen,
            d.nama,
            -- Array mahasiswa bimbingan 1 (Dihapus nilai NULL nya)
            ARRAY_REMOVE(ARRAY_AGG(CASE WHEN m.dosbing1_id = d.id THEN m.nama END), NULL) AS mahasiswa1,
            -- Array mahasiswa bimbingan 2
            ARRAY_REMOVE(ARRAY_AGG(CASE WHEN m.dosbing2_id = d.id THEN m.nama END), NULL) AS mahasiswa2
          FROM dosen d
          LEFT JOIN mahasiswa m ON (m.dosbing1_id = d.id OR m.dosbing2_id = d.id) ${filterClause}
          WHERE d.status_aktif = true
          GROUP BY d.id, d.kode_dosen, d.nama
          ORDER BY d.id ASC;
        `;
        
        const result = await pool.query(query, params);
        return result.rows;
    } catch (err) {
        console.error('❌ ERROR getDosenKeMahasiswa:', err);
        throw err;
    }
  },

  // 🔹 4. Insert/update dosen (Upsert berdasarkan NIP)
  upsertDosen: async ({ nip_dosen, nama, kode_dosen }) => {
    const query = `
      INSERT INTO dosen (nip_dosen, nama, kode_dosen)
      VALUES ($1, $2, $3)
      ON CONFLICT (nip_dosen) DO UPDATE 
        SET nama = EXCLUDED.nama,
            kode_dosen = EXCLUDED.kode_dosen
      RETURNING id;
    `;
    const result = await pool.query(query, [nip_dosen, nama, kode_dosen]);
    return result.rows[0].id;
  },

  // 🔹 5. Update mahasiswa → set dosbing1 / dosbing2 berdasarkan nama
  updateMahasiswaDosbing: async ({ mahasiswaNama, dosbingId, slot }) => {
    const column = slot === 'dosbing1' ? 'dosbing1_id' : 'dosbing2_id';
    const query = `UPDATE mahasiswa SET ${column} = $1 WHERE nama = $2;`;
    await pool.query(query, [dosbingId, mahasiswaNama.trim()]);
  },

  // 🔹 6. Ambil ID dosen berdasarkan kode_dosen
  getDosenIdByKode: async (kode_dosen) => {
    const result = await pool.query(
      'SELECT id FROM dosen WHERE kode_dosen = $1',
      [kode_dosen.trim()]
    );
    return result.rows[0]?.id || null;
  },

  // 🔹 7. Update dosbing via Kode Dosen (Cocok untuk fitur Import Excel)
  updateMahasiswaDosbingByKode: async ({ npm, pbb1, pbb2 }) => {
    try {
      const dosbing1Id = pbb1 ? await Dosbing.getDosenIdByKode(pbb1) : null;
      const dosbing2Id = pbb2 ? await Dosbing.getDosenIdByKode(pbb2) : null;

      if (!dosbing1Id && !dosbing2Id) return;

      await pool.query(`
        UPDATE mahasiswa
        SET dosbing1_id = COALESCE($1, dosbing1_id),
            dosbing2_id = COALESCE($2, dosbing2_id)
        WHERE npm = $3
      `, [dosbing1Id, dosbing2Id, npm.trim()]);
    } catch (err) {
      console.error('❌ Error updateMahasiswaDosbingByKode:', err);
    }
  },

  // 🔹 8. Update dosbing via ID langsung
  updateMahasiswaDosbingByIds: async ({ npm, dosbing1Id, dosbing2Id }) => {
    try {
      const result = await pool.query(`
        UPDATE mahasiswa
        SET dosbing1_id = $1,
            dosbing2_id = $2
        WHERE npm = $3
        RETURNING id
      `, [dosbing1Id, dosbing2Id, npm.trim()]);
      
      return result.rowCount > 0;
    } catch (err) {
      console.error('❌ ERROR updateMahasiswaDosbingByIds:', err);
      throw err;
    }
  },

  // 🔹 9. REKAP PEMBIMBING (DENGAN HISTORY TIAP TAHUN AJARAN)
  // Menghasilkan data untuk dashboard pemantauan distribusi bimbingan
  getRekapPerDosen: async (tahunId = null) => {
    try {
      const query = `
        SELECT 
          d.id, d.kode_dosen, d.nama,
          
          -- 1. Statistik berdasarkan tahun yang dipilih
          COUNT(DISTINCT CASE 
            WHEN m.dosbing1_id = d.id AND ($1::int IS NULL OR m.tahun_ajaran_id = $1) 
            THEN m.id END) AS jumlah_pbb1,
            
          COUNT(DISTINCT CASE 
            WHEN m.dosbing2_id = d.id AND ($1::int IS NULL OR m.tahun_ajaran_id = $1) 
            THEN m.id END) AS jumlah_pbb2,

          -- 2. Historis data bimbingan tiap semester (Aggregasi JSON)
          (
              SELECT COALESCE(JSON_AGG(row_to_json(t)), '[]')
              FROM (
                  SELECT
                      th.id AS th_id,
                      th.nama_tahun || ' ' || th.semester AS label,
                      COUNT(CASE WHEN m2.dosbing1_id = d.id THEN 1 END) as p1,
                      COUNT(CASE WHEN m2.dosbing2_id = d.id THEN 1 END) as p2
                  FROM mahasiswa m2
                  JOIN tahun_ajaran th ON m2.tahun_ajaran_id = th.id
                  WHERE m2.dosbing1_id = d.id OR m2.dosbing2_id = d.id
                  GROUP BY th.id, th.nama_tahun, th.semester
                  ORDER BY th.id DESC
              ) t
          ) AS history

        FROM dosen d
        LEFT JOIN mahasiswa m ON (m.dosbing1_id = d.id OR m.dosbing2_id = d.id)
        WHERE d.status_aktif = TRUE
        GROUP BY d.id, d.kode_dosen, d.nama
        ORDER BY d.id ASC;
      `;

      const res = await pool.query(query, [tahunId]);
      return res.rows;

    } catch (err) {
      console.error('❌ ERROR getRekapPerDosen:', err);
      return [];
    }
  },
};

module.exports = { Dosbing };