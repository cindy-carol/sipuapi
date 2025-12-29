// models/berkasModel.js
const pool = require('../config/db.js');

const Berkas = {
  // ===============================
  // 1. Ambil daftar berkas mahasiswa
  // ===============================
  getBerkasByMahasiswa: async (npm) => {
    const mhs = await pool.query(`SELECT id FROM mahasiswa WHERE npm = $1`, [npm]);
    if (!mhs.rows[0]) return null;

    const res = await pool.query(
      `SELECT 
        b.id, 
        b.jenis_berkas, 
        b.nama_berkas, 
        b.path_file, 
        b.tanggal_upload, 
        b.is_edited,
        bu.status_verifikasi,   
        bu.catatan_kesalahan    
       FROM berkas b
       LEFT JOIN berkas_ujian bu ON bu.berkas_id = b.id
       WHERE b.mahasiswa_id = $1 
       ORDER BY b.tanggal_upload DESC`,
      [mhs.rows[0].id]
    );

    const baseUrl = '/upload';
    return res.rows.map((b) => ({
      ...b,
      url_preview: b.path_file.startsWith('/upload')
        ? b.path_file
        : `${baseUrl}/${b.path_file}`,
    }));
  },

  // ===============================
  // 2. Ambil Catatan Kesalahan Spesifik
  // ===============================
  getCatatanByBerkasId: async (berkasId) => {
    const res = await pool.query(
      `SELECT catatan_kesalahan, status_verifikasi 
       FROM berkas_ujian 
       WHERE berkas_id = $1`,
      [berkasId]
    );
    return res.rows[0] || null;
  },

  // ===============================
  // 3. Simpan/upload berkas mahasiswa (CORE LOGIC)
  // ===============================
  saveBerkasMahasiswa: async (npm, jenis, nama, path_file) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Cari Mahasiswa ID
      const mhsRes = await client.query(`SELECT id FROM mahasiswa WHERE npm = $1`, [npm]);
      if (!mhsRes.rows[0]) throw new Error("Mahasiswa tidak ditemukan");
      const mahasiswa_id = mhsRes.rows[0].id;

      // 2. Insert/Update ke Tabel Berkas (Master File)
      const cek = await client.query(
        `SELECT id FROM berkas WHERE mahasiswa_id = $1 AND jenis_berkas = $2`,
        [mahasiswa_id, jenis]
      );

      let berkas_id;
      if (cek.rows.length > 0) {
        // Update file lama
const update = await client.query(
          `UPDATE berkas
           SET 
             nama_berkas = $1, 
             path_file = $2, 
             is_edited = TRUE, 
             edited_at = CURRENT_TIMESTAMP 
           WHERE id = $3 RETURNING id`,
          [nama, path_file, cek.rows[0].id]
        );
        berkas_id = update.rows[0].id;

      } else {
        const insert = await client.query(
          `INSERT INTO berkas (mahasiswa_id, jenis_berkas, nama_berkas, path_file, is_edited, edited_at)
           VALUES ($1, $2, $3, $4, FALSE, NULL) 
           RETURNING id`,
          [mahasiswa_id, jenis, nama, path_file]
        );
        berkas_id = insert.rows[0].id;
      }

      // -------------------------------------------------------------
      // 🔥 PERBAIKAN LOGIKA DAFTAR UJIAN DI SINI 🔥
      // -------------------------------------------------------------

      // A. Tentukan Syarat WAJIB (Agar masuk daftar ujian)
      // Cukup cek 'kartu_asistensi_1' saja. 2 dan 3 itu opsional.
      const syaratWajib = ['dokumen_rpl', 'draft_artikel', 'kartu_asistensi_1'];

      const cekLengkap = await client.query(
        `SELECT jenis_berkas FROM berkas 
         WHERE mahasiswa_id = $1 AND jenis_berkas = ANY($2::text[])`,
        [mahasiswa_id, syaratWajib]
      );

      const uploadedJenis = cekLengkap.rows.map(r => r.jenis_berkas);
      // Cek apakah semua syarat wajib ada di database
      const sudahLengkap = syaratWajib.every(j => uploadedJenis.includes(j));

      let daftar_ujian_id = null;

      if (sudahLengkap) {
        // B. Buat/Ambil Daftar Ujian
        const daftar = await client.query(
          `SELECT id FROM daftar_ujian WHERE mahasiswa_id = $1 LIMIT 1`, [mahasiswa_id]
        );

        if (daftar.rows.length === 0) {
          const newDaftar = await client.query(
            `INSERT INTO daftar_ujian (mahasiswa_id) VALUES ($1) RETURNING id`, [mahasiswa_id]
          );
          daftar_ujian_id = newDaftar.rows[0].id;
        } else {
          daftar_ujian_id = daftar.rows[0].id;
        }

        // C. Link-kan File ke berkas_ujian
        // Masukkan SEMUA file yang relevan (termasuk asistensi 2 & 3 jika ada)
        const allExamFiles = [
            'dokumen_rpl', 
            'draft_artikel', 
            'kartu_asistensi_1', 
            'kartu_asistensi_2', 
            'kartu_asistensi_3'
        ];

        for (const jenisFile of allExamFiles) {
          // Cari ID berkasnya dulu
          const b = await client.query(
            `SELECT id FROM berkas WHERE mahasiswa_id = $1 AND jenis_berkas = $2`,
            [mahasiswa_id, jenisFile]
          );

          if (b.rows[0]) {
            const thisBerkasId = b.rows[0].id;
            
            // Cek apakah sudah terhubung ke daftar_ujian?
            const linkExist = await client.query(
              `SELECT 1 FROM berkas_ujian WHERE daftar_ujian_id = $1 AND berkas_id = $2`,
              [daftar_ujian_id, thisBerkasId]
            );

            if (linkExist.rows.length === 0) {
              // Hubungkan (Insert)
              await client.query(
                `INSERT INTO berkas_ujian (daftar_ujian_id, berkas_id, status_verifikasi)
                 VALUES ($1, $2, null)`,
                [daftar_ujian_id, thisBerkasId]
              );
            } else {
              // Jika ini adalah file yang baru saja diupload (berkas_id sama dengan yang baru diproses), reset status
              if (thisBerkasId === berkas_id) {
                  await client.query(
                    `UPDATE berkas_ujian
                     SET status_verifikasi = NULL, catatan_kesalahan = NULL 
                     WHERE daftar_ujian_id = $1 AND berkas_id = $2`,
                    [daftar_ujian_id, thisBerkasId]
                  );
              }
            }
          }
        }
      }

      await client.query('COMMIT');

      return {
        success: true,
        lengkap: sudahLengkap,
        daftar_ujian_id,
      };

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // ... (fungsi updateStatusUI & getStatusVerifikasiMahasiswa biarkan tetap sama) ...
  updateStatusUI: async (daftarUjianId, berkasId, catatan) => {
    return pool.query(
      `UPDATE berkas_ujian
       SET catatan_kesalahan = $1
       WHERE daftar_ujian_id = $2 AND berkas_id = $3`,
      [catatan, daftarUjianId, berkasId]
    );
  },


  // ===============================
  // 🔧 Admin ubah status berkas ujian (UPDATE MODEL LAMA)
  // ===============================
  updateStatusUI: async (daftarUjianId, berkasId, catatan) => {
    return pool.query(
      `UPDATE berkas_ujian
       SET catatan_kesalahan = $1
       WHERE daftar_ujian_id = $2 AND berkas_id = $3`,
      [catatan, daftarUjianId, berkasId]
    );
  },

  // ===============================
  // 📌 Ambil status verifikasi
  // ===============================
  getStatusVerifikasiMahasiswa: async (npm) => {
    const res = await pool.query(
      `SELECT b.jenis_berkas, bu.status_verifikasi, bu.catatan_kesalahan
       FROM berkas b
       LEFT JOIN berkas_ujian bu ON bu.berkas_id = b.id
       WHERE b.mahasiswa_id = (SELECT id FROM mahasiswa WHERE npm = $1)`,
      [npm]
    );
    return res.rows;
  },

// models/berkasModel.js

  // ... kode sebelumnya ...

  // 👇 PERBAIKAN FUNGSI DELETE
// models/berkasModel.js

  deleteBerkas: async (npm, jenis) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Cek Data DB
        const mhs = await client.query(`SELECT id FROM mahasiswa WHERE npm = $1`, [npm]);
        if (!mhs.rows[0]) throw new Error("Mahasiswa not found");
        const mhsId = mhs.rows[0].id;

        const cekFile = await client.query(
            `SELECT id, path_file FROM berkas WHERE mahasiswa_id = $1 AND jenis_berkas = $2`,
            [mhsId, jenis]
        );

        if (cekFile.rows.length === 0) {
            await client.query('ROLLBACK');
            return { success: false, message: 'File tidak ditemukan di database' };
        }

        const { id, path_file } = cekFile.rows[0];

        // 2. Hapus Data DB (Prioritas Utama)
        await client.query(`DELETE FROM berkas_ujian WHERE berkas_id = $1`, [id]);
        await client.query(`DELETE FROM berkas WHERE id = $1`, [id]);

        // 3. Kunci Kemenangan (COMMIT)
        // Begitu ini lewat, data di web dipastikan hilang.
        await client.query('COMMIT'); 

        // 4. Hapus File Fisik (DIBUNGKUS TRY-CATCH SENDIRI)
        // Biar kalau gagal hapus file (misal file udah ilang duluan), 
        // dia TIDAK loncat ke catch utama dan tetap return success.
        try {
            // Bersihkan path (hilangkan slash depan kalau ada)
            const cleanPath = path_file.startsWith('/') ? path_file.substring(1) : path_file;
            const fullPath = path.join(__dirname, '../public', cleanPath);
            
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
            }
        } catch (fileErr) {
            // Cuma warning di terminal, jangan bikin user panik
            console.warn("⚠️ Warning: Data DB terhapus, tapi file fisik gagal dihapus/tidak ditemukan.", fileErr.message);
        }

        // TETAP RETURN SUKSES
        return { success: true };

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error Delete Berkas:', err);
        return { success: false, message: err.message };
    } finally {
        client.release();
    }
  },
};

module.exports = { Berkas };