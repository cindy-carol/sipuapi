const pool = require('../config/db.js');

const Dosbing = {
  // 🔹 Ambil daftar mahasiswa + dosbing (dengan kode_dosen), bisa filter per tahun
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

  // 🔹 Ambil data mahasiswa → dosbing (Simple list)
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

  // 🔹 Ambil data dosen → mahasiswa bimbingan (FILTERED BY YEAR)
  // Used for: Tab "Dosen ke Mahasiswa" AND Dropdown population
  getDosenKeMahasiswa: async (tahunId = null) => {
    try {
        // Param management
        const params = [];
        let filterClause = "";
        
        // If year is provided, we filter the JOIN condition
        // This ensures we get ALL lecturers, but only attach students from the specific year
        if (tahunId) {
            filterClause = " AND m.tahun_ajaran_id = $1";
            params.push(tahunId);
        }

        const query = `
          SELECT 
            d.id AS dosen_id,
            d.kode_dosen,
            d.nama,
            -- Array of students where this docent is PBB1 (Filtered by year)
            ARRAY_REMOVE(ARRAY_AGG(CASE WHEN m.dosbing1_id = d.id THEN m.nama END), NULL) AS mahasiswa1,
            -- Array of students where this docent is PBB2 (Filtered by year)
            ARRAY_REMOVE(ARRAY_AGG(CASE WHEN m.dosbing2_id = d.id THEN m.nama END), NULL) AS mahasiswa2
          FROM dosen d
          -- Join with students, applying the year filter inside the join condition
          -- This is crucial: it keeps the lecturer row even if no students match the year
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

  // 🔹 Insert/update dosen (by nip unik)
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

  // 🔹 Update mahasiswa → set dosbing1 / dosbing2 berdasarkan nama dosen
  updateMahasiswaDosbing: async ({ mahasiswaNama, dosbingId, slot }) => {
    const column = slot === 'dosbing1' ? 'dosbing1_id' : 'dosbing2_id';
    const query = `UPDATE mahasiswa SET ${column} = $1 WHERE nama = $2;`;
    await pool.query(query, [dosbingId, mahasiswaNama.trim()]);
  },

  // 🔹 Ambil ID dosen berdasarkan kode_dosen
  getDosenIdByKode: async (kode_dosen) => {
    const result = await pool.query(
      'SELECT id FROM dosen WHERE kode_dosen = $1',
      [kode_dosen.trim()]
    );
    return result.rows[0]?.id || null;
  },

  // 🔹 Update mahasiswa → set dosbing berdasarkan KODE dosen (buat pemetaan Excel)
  updateMahasiswaDosbingByKode: async ({ npm, pbb1, pbb2 }) => {
    try {
      const dosbing1Id = pbb1 ? await Dosbing.getDosenIdByKode(pbb1) : null;
      const dosbing2Id = pbb2 ? await Dosbing.getDosenIdByKode(pbb2) : null;

      if (!dosbing1Id && !dosbing2Id) {
        console.warn(`⚠️ Kode dosen tidak ditemukan untuk NPM ${npm}`);
        return;
      }

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

  // =================================================================
  // 🔥🔥🔥 FITUR BARU: REKAP DOSEN PEMBIMBING (DITAMBAHKAN) 🔥🔥🔥
  // =================================================================
  getRekapPerDosen: async (tahunId = null) => {
    try {
      const query = `
        SELECT 
          d.id, d.kode_dosen, d.nama,
          
          -- 1. STATISTIK UTAMA (IKUT FILTER TAHUN)
          COUNT(DISTINCT CASE 
            WHEN m.dosbing1_id = d.id AND ($1::int IS NULL OR m.tahun_ajaran_id = $1) 
            THEN m.id END) AS jumlah_pbb1,
            
          COUNT(DISTINCT CASE 
            WHEN m.dosbing2_id = d.id AND ($1::int IS NULL OR m.tahun_ajaran_id = $1) 
            THEN m.id END) AS jumlah_pbb2,

          -- 2. HISTORY LENGKAP (TETAP DIAMBIL SEMUA TAHUN)
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