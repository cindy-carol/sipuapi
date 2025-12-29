// models/berkasModel.js
const pool = require('../config/db');
const supabase = require('../config/supabaseClient'); // Pastikan path ini benar

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

    // Karena kita sudah menyimpan Full Public URL dari Supabase ke DB, 
    // kita tidak perlu lagi menambahkan prefix manual
    return res.rows;
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
      // 🔥 LOGIKA OTOMATIS DAFTAR UJIAN 🔥
      // -------------------------------------------------------------

      const syaratWajib = ['dokumen_rpl', 'draft_artikel', 'kartu_asistensi_1'];

      const cekLengkap = await client.query(
        `SELECT jenis_berkas FROM berkas 
         WHERE mahasiswa_id = $1 AND jenis_berkas = ANY($2::text[])`,
        [mahasiswa_id, syaratWajib]
      );

      const uploadedJenis = cekLengkap.rows.map(r => r.jenis_berkas);
      const sudahLengkap = syaratWajib.every(j => uploadedJenis.includes(j));

      let daftar_ujian_id = null;

      if (sudahLengkap) {
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

        const allExamFiles = [
            'dokumen_rpl', 
            'draft_artikel', 
            'kartu_asistensi_1', 
            'kartu_asistensi_2', 
            'kartu_asistensi_3'
        ];

        for (const jenisFile of allExamFiles) {
          const b = await client.query(
            `SELECT id FROM berkas WHERE mahasiswa_id = $1 AND jenis_berkas = $2`,
            [mahasiswa_id, jenisFile]
          );

          if (b.rows[0]) {
            const thisBerkasId = b.rows[0].id;
            
            const linkExist = await client.query(
              `SELECT 1 FROM berkas_ujian WHERE daftar_ujian_id = $1 AND berkas_id = $2`,
              [daftar_ujian_id, thisBerkasId]
            );

            if (linkExist.rows.length === 0) {
              await client.query(
                `INSERT INTO berkas_ujian (daftar_ujian_id, berkas_id, status_verifikasi)
                 VALUES ($1, $2, null)`,
                [daftar_ujian_id, thisBerkasId]
              );
            } else {
              // Jika user ganti file, reset status verifikasi admin jadi NULL (perlu diperiksa ulang)
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
      return { success: true, lengkap: sudahLengkap, daftar_ujian_id };

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // ===============================
  // 🔧 Update Status (Admin Side)
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
  // 📌 Ambil status verifikasi (Lock UI)
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

  // ===============================
  // 🗑️ PERBAIKAN FUNGSI DELETE (Cloud Sync)
  // ===============================
  deleteBerkas: async (npm, jenis) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const mhs = await client.query(`SELECT id FROM mahasiswa WHERE npm = $1`, [npm]);
        if (!mhs.rows[0]) throw new Error("Mahasiswa tidak ditemukan");
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

        // 1. Hapus Data dari DB Relasi
        await client.query(`DELETE FROM berkas_ujian WHERE berkas_id = $1`, [id]);
        await client.query(`DELETE FROM berkas WHERE id = $1`, [id]);

        await client.query('COMMIT'); 

        // 2. Hapus File Fisik dari Supabase Storage
        try {
            // Kita ambil path aslinya dari URL (menghapus domain dan nama bucket)
            // URL: https://xxx.supabase.co/storage/v1/object/public/storage_sipuapi/berkas/2024/ganjil/NPM/file.pdf
            const cleanPath = path_file.split('storage_sipuapi/').pop(); 

            const { error: deleteError } = await supabase.storage
                .from('storage_sipuapi')
                .remove([cleanPath]);

            if (deleteError) throw deleteError; 
        } catch (fileErr) {
            console.warn("⚠️ Warning: Data DB terhapus, tapi file cloud gagal dihapus atau tidak ditemukan.", fileErr.message);
        }

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