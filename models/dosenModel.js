// models/dosenModel.js
const pool = require('../config/db.js');// Sesuaikan path config db kamu
const xlsx = require('xlsx');
const bcrypt = require('bcrypt');

const Dosen = {
  // ===============================
  // AMBIL SEMUA DATA
  // ===============================
  getAll: async () => {
    const res = await pool.query(
      `SELECT nip_dosen, nama, status_aktif, jabatan, kode_dosen FROM dosen 
      ORDER BY status_aktif DESC, id ASC`
    );
    return res.rows;
  },

  // ===============================
  // CEK APAKAH NIP ADA
  // ===============================
  exists: async (nip, excludeId = null) => {
    let query = `SELECT id FROM dosen WHERE nip_dosen = $1`;
    const params = [nip];

    if (excludeId) {
        query += ` AND id != $2`;
        params.push(excludeId);
    }

    const res = await pool.query(query, params);
    return res.rows.length > 0 ? res.rows[0].id : null; 
  },

  // ===============================
  // CEK KODE DOSEN
  // ===============================
  existsKode: async (kode, excludeId = null) => {
    let query = `SELECT id FROM dosen WHERE kode_dosen = $1`;
    const params = [kode];

    if (excludeId) {
        query += ` AND id != $2`;
        params.push(excludeId);
    }

    const res = await pool.query(query, params);
    return res.rows.length > 0 ? res.rows[0].id : null;
  },

  // ===============================
  // INSERT MANUAL
  // ===============================
  insert: async ({ nip_dosen, nama, status_aktif = true, jabatan = '', kode_dosen = '' }) => {
    const res = await pool.query(
      `INSERT INTO dosen (nip_dosen, nama, status_aktif, jabatan, kode_dosen)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [nip_dosen, nama, status_aktif, jabatan, kode_dosen]
    );
    return res.rows[0].id;
  },

  // ===============================
  // UPDATE MANUAL
  // ===============================
  update: async ({ nip_dosen, nama, status_aktif = true, jabatan = '', kode_dosen = '' }) => {
    await pool.query(
      `UPDATE dosen SET nama=$1, status_aktif=$2, jabatan=$3, kode_dosen=$4 WHERE nip_dosen=$5`,
      [nama, status_aktif, jabatan, kode_dosen, nip_dosen]
    );
  },

updateByKodeDosen: async (kodeLama, { nip_dosen, nama, status_aktif, jabatan, kode_dosen }) => {
    const res = await pool.query(
      `UPDATE dosen 
       SET nip_dosen=$1, nama=$2, status_aktif=$3, jabatan=$4, kode_dosen=$5
       WHERE kode_dosen=$6`, 
      [nip_dosen, nama, status_aktif, jabatan, kode_dosen, kodeLama]
    );
    return res.rowCount;
  },

  getByKodeDosen: async (kode) => {
    const res = await pool.query(
      `SELECT id, nip_dosen, nama, status_aktif, jabatan, kode_dosen FROM dosen WHERE kode_dosen = $1`,
      [kode]
    );
    return res.rows[0]; 
  },

  // 🔥 PERBAIKAN FUNGSI SYNC


  removeByKodeDosen: async (kode) => {
    const res = await pool.query(`DELETE FROM dosen WHERE kode_dosen = $1`, [kode]);
    return res; 
  },

  // ===============================
  // UPLOAD EXCEL
  // ===============================
  uploadExcel: async (filePath) => {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    for (const row of data) {
      const normalize = (val) => val ? String(val).trim() : '';
      const nip_dosen = normalize(row.NIP || row.nip_dosen).replace(/\s+/g, '');
      const nama = normalize(row.Nama || row.nama);
      const statusAktifRaw = normalize(row.Status_Aktif || row.status_aktif);
      const jabatan = normalize(row.Jabatan || row.jabatan);
      const kode_dosen = normalize(row.Kode_Dosen || row.kode_dosen);

      if (!nip_dosen || !nama) continue;

      const status_aktif = ['true', 'aktif', '1'].includes(statusAktifRaw.toLowerCase());
      const existingId = await Dosen.exists(nip_dosen);

      if (existingId) {
        await Dosen.update({ nip_dosen, nama, status_aktif, jabatan, kode_dosen });
      } else {
        await Dosen.insert({ nip_dosen, nama, status_aktif, jabatan, kode_dosen });
      }
    }
  },

  syncKaprodiAccounts: async () => {
    try {
      console.log("🔄 --- MULAI SYNC STATUS & NAMA KAPRODI ---");

      // Pastikan d.status_aktif diambil dari tabel dosen
      const { rows: dosenList } = await pool.query(`
        SELECT d.nip_dosen, d.nama, d.jabatan, d.status_aktif, 
               a.id as id_akun, a.role as role_akun, a.status_aktif as akun_aktif
        FROM dosen d
        LEFT JOIN akun a ON d.nip_dosen = a.username
      `);

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('kaprodi123', salt);

      for (const d of dosenList) {
        const isKaprodi = d.jabatan && String(d.jabatan).includes('Kaprodi'); 
        
        if (isKaprodi) {
          if (!d.id_akun) {
            // Akun baru mengikuti status_aktif dosen
            await pool.query(
              `INSERT INTO akun (username, password, role, status_aktif, nama) 
               VALUES ($1, $2, 'kaprodi', $3, $4)`,
              [d.nip_dosen, hashedPassword, d.status_aktif, d.nama]
            );
          } else {
            // 🔥 UPDATE: Akun WAJIB ikut status_aktif dosen (d.status_aktif)
            await pool.query(
              `UPDATE akun 
               SET role = 'kaprodi', status_aktif = $1, nama = $2 
               WHERE id = $3`,
              [d.status_aktif, d.nama, d.id_akun]
            );
          }
          
          // Matikan Kaprodi lain jika dosen ini adalah Kaprodi yang AKTIF
          if (d.status_aktif) {
            await pool.query(
              `UPDATE akun SET status_aktif = false 
               WHERE role = 'kaprodi' AND username != $1`,
              [d.nip_dosen]
            );
          }
        } else {
          // Jika bukan Kaprodi tapi punya akun role kaprodi, matikan akunnya
          if (d.id_akun && d.role_akun === 'kaprodi' && d.akun_aktif === true) {
             await pool.query(`UPDATE akun SET status_aktif = false WHERE id = $1`, [d.id_akun]);
          }
        }
      }
      console.log(`✅ Sync Selesai.`);
    } catch (err) {
      console.error('❌ ERROR di syncKaprodiAccounts:', err);
    }
  },
};

module.exports = { Dosen };