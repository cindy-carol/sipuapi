// controllers/admin/cekBerkasController
const model = require("../../models/cekBerkasModel");
const { Mahasiswa } = require('../../models/mahasiswaModel');
const { Berkas } = require('../../models/berkasModel');

const cekBerkasController = {

  // ===== Halaman utama verifikasi berkas =====
list: async (req, res) => {
    try {
      // 1. 🛑 FIX LOGIKA NPM: Ambil dari URL, bukan Session
      const { npm } = req.params; 

      if (!npm) {
          return res.status(400).send("Parameter NPM tidak ditemukan");
      }

      // 2. Ambil Data Mahasiswa Target
      const mhs = await Mahasiswa.getMahasiswaByNPM(npm);
      
      if (!mhs) {
          return res.status(404).send(`Mahasiswa dengan NPM ${npm} tidak ditemukan.`);
      }

      // 3. Ambil Berkas Mahasiswa Tersebut
      // Gunakan fungsi model yang sudah kita update sebelumnya (yang return Array lengkap)
      const rawBerkas = await Berkas.getBerkasByMahasiswa(npm);
      
      // Mapping status UI (Opsional, tapi bagus buat konsistensi)
      const berkasList = (rawBerkas || []).map(b => {
        let statusLabel = 'Menunggu';
        let statusClass = 'warning';

        if (b.status_verifikasi === true) {
            statusLabel = 'Diterima';
            statusClass = 'success';
        } else if (b.status_verifikasi === false) {
            statusLabel = 'Ditolak';
            statusClass = 'danger';
        }

        return {
            ...b,
            status: statusLabel,     // Label Text
            statusClass: statusClass // CSS Class
        };
      });

      // 4. Render View
      // Kirim 'berkasList' yang sudah rapi
          res.locals.hideSidebar = true;
      res.render('admin/cek-berkas', {
        title: 'Cek Berkas',
        currentPage: 'cek-berkas',
        role: 'admin',
        
        // Data Mahasiswa
        mahasiswa: mhs, // Object mahasiswa lengkap
        nama: mhs.nama,
        npm: mhs.npm,
        thajaran: `${mhs.nama_tahun} ${mhs.semester}`,
        dosbing1: mhs.dosbing1,
        dosbing2: mhs.dosbing2,
        
        // Data Berkas
        berkasList: berkasList,
        
      });

    } catch (err) {
      console.error('❌ Error list cek-berkas:', err);
      res.status(500).send("Terjadi kesalahan server saat memuat data.");
    }
  },

  // Fungsi khusus menangani Form Modal (Supaya bisa redirect)
// Fungsi khusus menangani Form Modal
rejectBerkas: async (req, res) => {
    try {
      const { berkas_id, alasan_kode, npm } = req.body;
      
      // 🔥 AMBIL ID ADMIN
      const adminId = req.session.user?.id || null;
      
      let pesan = 'Mohon perbaiki berkas ini.';
      if (alasan_kode === '1') pesan = 'Berkas yang diupload salah/tidak sesuai.';
      else if (alasan_kode === '2') pesan = 'Scan berkas buram/tidak terbaca.';
      else if (alasan_kode === '3') pesan = 'Tanda tangan/stempel belum lengkap.';
      
      // 🔥 Masukkan adminId sebagai parameter ke-4
      await model.updateStatus(berkas_id, false, pesan, adminId);

      if (npm) {
        return res.redirect(`/admin/verifikasi/cek-berkas/${npm}`);
      } else {
        return res.redirect('back'); 
      }

    } catch (err) {
      console.error('❌ Error reject berkas:', err);
      return res.redirect('back'); 
    }
  },

  // ===== Kembalikan semua berkas ke mahasiswa =====
  returnToMahasiswa: async (req, res) => {
    try {
      const { npm, catatan } = req.body; 
      
      // 🔥 AMBIL ID ADMIN
      const adminId = req.session.user?.id || null;

      console.log(`🔄 Mengembalikan berkas NPM: ${npm} oleh Admin ID: ${adminId}`);

      const mahasiswa = await model.getMahasiswaByNpm(npm);
      if (!mahasiswa) return res.status(404).send("Mahasiswa tidak ditemukan!");

      // Update DB
      await model.updateBerkasStatus({ 
          mahasiswaId: mahasiswa.id, 
          status: false, 
          catatan_kesalahan: catatan,
          adminId: adminId // 🔥 Kirim adminId ke model
      });
      
      res.json({ success: true });

    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server Error" });
    }
  },

  // ===== Update status verifikasi satu berkas =====
  updateStatusById: async (id, status) => {
    try {
      const statusBool = status === 'true';
      await model.updateStatus(id, statusBool);
      return true;
    } catch (err) {
      console.error('❌ Gagal update status berkas:', err);
      return false;
    }
  },
};

module.exports = cekBerkasController;
