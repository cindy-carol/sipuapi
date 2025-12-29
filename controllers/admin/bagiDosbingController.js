const xlsx = require("xlsx");
const pool = require("../../config/db");
const path = require("path");
const fs = require("fs"); 
const { Dosbing } = require('../../models/dosbingModel');
const { TahunAjaran } = require('../../models/tahunAjaranModel');

const dosbingController = {

  // =========================================================================
  // 1. RENDER HALAMAN (SAFE MODE: DROPDOWN & FILTER AMAN ✅)
  // =========================================================================
  renderbagiDosbing: async (req, res) => {
    console.time('⏱️ Load Bagi Dosbing');

    try {
      const tahunAjarList = await TahunAjaran.getListForSelect();
      
      // Ambil Filter dari URL (Default ke sesi atau tahun pertama)
      let selectedTahunId = req.query.tahun_ajaran || req.selectedTahunId || (tahunAjarList[0]?.id);
      
      // Ambil Tab Aktif (Default 'mahasiswa')
      const activeTab = req.query.tab || 'mahasiswa';

      // ============================================================
      // 🔥 LOGIC FIX: DATA DOSEN SELALU DIPANGGIL
      // ============================================================
      // KOREKSI DI SINI BANG: Tambahin 'selectedTahunId' biar filternya jalan
      // Model lo udah pinter kok, dia bakal tetep balikin semua dosen buat dropdown,
      // tapi array mahasiswanya bakal difilter sesuai tahun ini.
      const dosenKeMahasiswa = await Dosbing.getDosenKeMahasiswa(selectedTahunId); 
      
      // Bikin list nama dosen juga (buat jaga-jaga kalau EJS lo butuh ini)
      const daftarDosen = dosenKeMahasiswa.map(d => d.nama);

      // ============================================================
      // 🧊 LOGIC HEMAT: CUMA DATA MAHASISWA YANG DI-SWITCH
      // ============================================================
      let dosbing = []; // Default kosong biar enteng

      // Cuma ambil data mahasiswa kalau user lagi buka tab 'mahasiswa'
      if (activeTab === 'mahasiswa') {
        dosbing = await Dosbing.getAll(selectedTahunId);
      }

      console.timeEnd('⏱️ Load Bagi Dosbing');

      res.render("admin/bagi-dosbing", {
        title: "Pembagian Dosen Pembimbing",
        role: "admin",
        currentPage: "bagi-dosbing",
        activePage: "bagi-dosbing",
        
        // Kirim state Tab & Tahun biar UI gak bingung
        activeTab,       
        selectedTahunId,
        tahunAjarList,

        // Data Utama
        dosbing,           // Isi: Data Mahasiswa (Array Kosong kalau lagi di tab dosen)
        dosenKeMahasiswa,  // Isi: Data Dosen (SELALU ADA ✅)
        daftarDosen        // Isi: List Nama Dosen (SELALU ADA ✅)
      });

    } catch (err) {
      console.error("❌ Error renderbagiDosbing:", err);
      res.status(500).send("Terjadi kesalahan saat mengambil data.");
    }
  },

  // =========================================================================
  // 2. UPLOAD EXCEL (GAK DIUBAH)
  // =========================================================================
  uploadDosbing: async (req, res) => {
    const file = req.files?.["daftar_dosbing"]?.[0];

    if (!file) return res.status(400).send("File belum diupload!");

    try {
      const workbook = xlsx.readFile(file.path);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = xlsx.utils.sheet_to_json(sheet);

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

      const adminId = req.session.user?.id || null;
      // Gunakan filename dari Multer agar unik (ada timestampnya)
      const relativePath = `/upload/admin/daftar/${file.filename}`; 

      await pool.query(`
          INSERT INTO upload_excel (jenis_data, nama_file, path_file, tanggal_upload, admin_id)
          VALUES ($1, $2, $3, NOW(), $4)
      `, ['dosbing', file.filename, relativePath, adminId]);

      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

      const currentTahun = req.body.tahun_ajaran || req.query.tahun_ajaran || '';
      res.redirect(`/admin/bagi-dosbing?tab=mahasiswa&tahun_ajaran=${currentTahun}&status=success`);

    } catch (err) {
      console.error("❌ Error uploadDosbing:", err);
      res.status(500).send("Terjadi kesalahan: " + err.message);
    }
  },

  // =========================================================================
  // 3. EDIT DOSBING (GAK DIUBAH)
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
      if (err.code === '23503') { 
          return res.status(400).json({ success: false, message: 'Dosen/NPM tidak valid.' });
      }
      res.status(500).json({ success: false, message: 'Gagal memperbarui data.' });
    }
  }
};

module.exports = dosbingController;