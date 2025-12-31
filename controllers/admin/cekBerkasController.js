// controllers/admin/cekBerkasController.js
const model = require("../../models/cekBerkasModel");
const { Mahasiswa } = require('../../models/mahasiswaModel');
const { Berkas } = require('../../models/berkasModel');

const cekBerkasController = {

  // =========================================================================
  // 🔍 1. RENDER HALAMAN CEK BERKAS (VIEWER)
  // =========================================================================
  list: async (req, res) => {
    try {
      // Ambil NPM dari parameter URL
      const { npm } = req.params; 

      if (!npm) {
          return res.status(400).send("Parameter NPM tidak ditemukan");
      }

      // Ambil data profil mahasiswa target
      const mhs = await Mahasiswa.findByNPM(npm);
      
      if (!mhs) {
          return res.status(404).send(`Mahasiswa dengan NPM ${npm} tidak ditemukan.`);
      }

      // Ambil semua berkas mahasiswa (URL dari Supabase sudah termasuk di sini)
      const rawBerkas = await Berkas.getBerkasByMahasiswa(npm);
      
      // Mapping untuk kebutuhan tampilan UI (Badge & Status)
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
            status: statusLabel,     
            statusClass: statusClass,
            // URL file langsung mengarah ke Supabase Storage
            url_file: b.path_file 
        };
      });

      // Render view admin/cek-berkas
      res.locals.hideSidebar = true;
      res.render('admin/cek-berkas', {
        title: 'Cek Berkas Mahasiswa',
        currentPage: 'cek-berkas',
        role: 'admin',
        
        // Data Mahasiswa
        mahasiswa: mhs,
        nama: mhs.nama,
        npm: mhs.npm,
        thajaran: `${mhs.nama_tahun} ${mhs.semester}`,
        dosbing1: mhs.nama_dosbing1,
        dosbing2: mhs.nama_dosbing2,
        
        // List Berkas untuk dalooping di EJS
        berkasList: berkasList
      });

    } catch (err) {
      console.error('❌ Error list cek-berkas:', err);
      res.status(500).send("Terjadi kesalahan server saat memuat data.");
    }
  },

  // =========================================================================
  // ❌ 2. REJECT BERKAS (SATU PER SATU VIA MODAL)
  // =========================================================================
// Ganti fungsi rejectBerkas lama kamu dengan ini:
rejectBerkas: async (req, res) => {
  try {
    // Ambil alasan_khusus dari body (input textarea)
    const { berkas_id, alasan_kode, alasan_khusus, npm } = req.body;
    const adminId = req.session.user?.id || null;
    
    let pesan = '';
    
    // Logika pemilihan pesan yang dinamis
    if (alasan_kode === '1') {
      pesan = 'Berkas yang diupload salah/tidak sesuai.';
    } else if (alasan_kode === '2') {
      pesan = 'Scan berkas buram atau tidak terbaca.';
    } else if (alasan_kode === '3') {
      pesan = 'Tanda tangan atau stempel belum lengkap.';
    } else if (alasan_kode === 'lainnya') {
      // Jika pilih lainnya, gunakan isi dari textarea
      pesan = alasan_khusus ? alasan_khusus.trim() : 'Mohon perbaiki berkas ini.';
    } else {
      pesan = 'Mohon perbaiki berkas ini.';
    }
    
    // Kirim 'pesan' yang sudah berisi rincian manual ke database
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

  // =========================================================================
  // 🔄 3. RETURN TO MAHASISWA (TOLAK SEMUA BERKAS SEKALIGUS)
  // =========================================================================
  returnToMahasiswa: async (req, res) => {
    try {
      const { npm, catatan } = req.body; 
      const adminId = req.session.user?.id || null;

      const mahasiswa = await model.getMahasiswaByNpm(npm);
      if (!mahasiswa) return res.status(404).send("Mahasiswa tidak ditemukan!");

      // Update status semua berkas menjadi FALSE
      await model.updateBerkasStatus({ 
          mahasiswaId: mahasiswa.id, 
          status: false, 
          catatan_kesalahan: catatan,
          adminId: adminId 
      });
      
      res.json({ success: true, message: "Semua berkas telah dikembalikan untuk revisi." });

    } catch (err) {
      console.error('❌ Error returnToMahasiswa:', err);
      res.status(500).json({ success: false, message: "Gagal memproses pengembalian berkas." });
    }
  },

  // =========================================================================
  // ✅ 4. APPROVE BERKAS (BY ID)
  // =========================================================================
  updateStatusById: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body; // Terima string 'true' atau 'false'
      const adminId = req.session.user?.id || null;

      const statusBool = status === 'true';
      await model.updateStatus(id, statusBool, statusBool ? 'Lengkap' : null, adminId);
      
      res.json({ success: true, message: "Status berkas berhasil diperbarui." });
    } catch (err) {
      console.error('❌ Gagal update status berkas:', err);
      res.status(500).json({ success: false, message: "Gagal update status." });
    }
  },
};

module.exports = cekBerkasController;