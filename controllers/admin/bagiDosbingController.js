// controllers/admin/bagiDosbingController.js
const xlsx = require("xlsx");
const pool = require("../../config/db");
const supabase = require('../../config/supabaseClient'); // Import client Supabase
const { Dosbing } = require('../../models/dosbingModel');
const { TahunAjaran } = require('../../models/tahunAjaranModel');

const dosbingController = {

  // =========================================================================
  // 1. RENDER HALAMAN (Mendukung Filter Tahun Ajaran & Tab UI)
  // =========================================================================
  renderbagiDosbing: async (req, res) => {
    console.time('⏱️ Load Bagi Dosbing');

    try {
      const tahunAjarList = await TahunAjaran.getListForSelect();
      
      // Ambil Filter dari URL (Default ke tahun ajaran pertama jika tidak ada)
      let selectedTahunId = req.query.tahun_ajaran || req.selectedTahunId || (tahunAjarList[0]?.id);
      
      // Ambil Tab Aktif (Default 'mahasiswa')
      const activeTab = req.query.tab || 'mahasiswa';

      // Mengambil data pemetaan dosen ke mahasiswa berdasarkan tahun ajaran terpilih
      const dosenKeMahasiswa = await Dosbing.getDosenKeMahasiswa(selectedTahunId); 
      
      // List nama dosen untuk keperluan UI/Dropdown
      const daftarDosen = dosenKeMahasiswa.map(d => d.nama);

      let dosbing = []; 

      // Hanya ambil data mahasiswa lengkap jika berada di tab 'mahasiswa' (optimasi performa)
      if (activeTab === 'mahasiswa') {
        dosbing = await Dosbing.getAll(selectedTahunId);
      }

      console.timeEnd('⏱️ Load Bagi Dosbing');

      res.render("admin/bagi-dosbing", {
        title: "Pembagian Dosen Pembimbing",
        role: "admin",
        currentPage: "bagi-dosbing",
        activePage: "bagi-dosbing",
        
        activeTab,       
        selectedTahunId,
        tahunAjarList,

        // Data Utama
        dosbing,           
        dosenKeMahasiswa,  
        daftarDosen        
      });

    } catch (err) {
      console.error("❌ Error renderbagiDosbing:", err);
      res.status(500).send("Terjadi kesalahan saat mengambil data.");
    }
  },

  // =========================================================================
  // 2. UPLOAD EXCEL (VERSI VERCEL & SUPABASE STORAGE)
  // =========================================================================
  uploadDosbing: async (req, res) => {
    // Mengambil file dari Multer memoryStorage
    const file = req.files?.["daftar_dosbing"]?.[0];

    if (!file) return res.status(400).send("File belum diupload!");

    try {
      // 1. BACA EXCEL DARI BUFFER (RAM) - Menghindari error sistem file di Vercel 
      const workbook = xlsx.read(file.buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = xlsx.utils.sheet_to_json(sheet);

      // 2. PARSING & UPDATE DATABASE
      const mahasiswaDosbingExcel = data.map(row => ({
        npm: row["NPM"]?.toString().trim() || "",
        nama: row["Nama"] || "",
        pbb1: row["PBB1"]?.toString().trim() || "",
        pbb2: row["PBB2"]?.toString().trim() || ""
      }));

      for (const mhs of mahasiswaDosbingExcel) {
        if (!mhs.npm) continue; 
        await Dosbing.updateMahasiswaDosbingByKode({
          npm: mhs.npm,
          pbb1: mhs.pbb1,
          pbb2: mhs.pbb2
        });
      }

      // 3. UPLOAD FILE ASLI KE SUPABASE STORAGE SEBAGAI ARSIP
      const fileName = `dosbing-${Date.now()}-${file.originalname}`;
      const filePath = `upload_excel/dosbing/${fileName}`; // Path folder di Supabase Bucket 

      const { error: uploadError } = await supabase.storage
        .from('storage_sipuapi')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Ambil Public URL untuk disimpan di log database
      const { data: urlData } = supabase.storage
        .from('storage_sipuapi')
        .getPublicUrl(filePath);

      // 4. LOG KE TABEL UPLOAD_EXCEL
      const adminId = req.session.user?.id || null;
      await pool.query(`
          INSERT INTO upload_excel (jenis_data, nama_file, path_file, tanggal_upload, admin_id)
          VALUES ($1, $2, $3, NOW(), $4)
      `, ['dosbing', fileName, urlData.publicUrl, adminId]);

      const currentTahun = req.body.tahun_ajaran || req.query.tahun_ajaran || '';
      res.redirect(`/admin/bagi-dosbing?tab=mahasiswa&tahun_ajaran=${currentTahun}&status=success`);

    } catch (err) {
      console.error("❌ Error uploadDosbing:", err);
      res.status(500).send("Terjadi kesalahan proses Excel: " + err.message);
    }
  },

  // =========================================================================
  // 3. EDIT DOSBING (Update Manual per Mahasiswa)
  // =========================================================================
  editDosbing: async (req, res) => {
    const { npm } = req.params;
    const { dosbing1_id, dosbing2_id } = req.body; 

    try {
      const id1 = dosbing1_id ? parseInt(dosbing1_id) : null;
      const id2 = dosbing2_id ? parseInt(dosbing2_id) : null;
      
      const result = await Dosbing.updateMahasiswaDosbingByIds({
        npm: npm,
        dosbing1Id: id1,
        dosbing2Id: id2
      });

      if (!result) {
        return res.status(404).json({ success: false, message: 'Mahasiswa tidak ditemukan.' });
      }

      res.status(200).json({ success: true, message: 'Dosen Pembimbing berhasil diperbarui.' });
    } catch (err) {
      console.error('❌ Error editDosbing:', err);
      // Handle error jika ID dosen tidak ditemukan di tabel master dosen
      if (err.code === '23503') { 
          return res.status(400).json({ success: false, message: 'ID Dosen atau NPM tidak valid.' });
      }
      res.status(500).json({ success: false, message: 'Gagal memperbarui data pembimbing.' });
    }
  }
};

module.exports = dosbingController;