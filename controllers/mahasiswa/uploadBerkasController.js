// controllers/mahasiswa/uploadBerkasController.js
const supabase = require('../../config/supabaseClient');
const { Berkas } = require('../../models/berkasModel');
const { Mahasiswa } = require('../../models/mahasiswaModel');

// ==========================
// 📄 Render halaman upload
// ==========================
const showUploadPage = async (req, res) => {
  try {
    if (!req.session.user) return res.status(403).send('Akses ditolak');

    const npm = req.session.user.npm;
    const mhs = await Mahasiswa.getMahasiswaByNPM(npm);
    
    // Ambil data dari database melalui model
    const rawBerkas = await Berkas.getBerkasByMahasiswa(npm); 

    // Konversi array dari database ke object agar mudah dibaca EJS
    const berkasMahasiswa = {};
    if (rawBerkas && Array.isArray(rawBerkas)) {
      rawBerkas.forEach(item => {
        berkasMahasiswa[item.jenis_berkas] = {
            path: item.path_file,
            status: item.status_verifikasi,       
            catatan: item.catatan_kesalahan       
        };
      });
    }

    // Status badge untuk tampilan UI
    const sudahUpload = berkasMahasiswa.dokumen_rpl?.path || 
                        berkasMahasiswa.draft_artikel?.path || 
                        berkasMahasiswa.kartu_asistensi_1?.path;

    let badge = { text: 'Belum Upload', class: 'bg-secondary' };
    if (sudahUpload) badge = { text: 'Menunggu Verifikasi', class: 'bg-warning' };

    res.render('mahasiswa/upload-berkas', {
      title: 'Upload Berkas',
      currentPage: 'upload-berkas',
      role: 'Mahasiswa',
      nama: mhs.nama,
      npm: mhs.npm,
      thajaran: `${mhs.nama_tahun} ${mhs.semester}`,
      badge,
      
      // Kirim data terpisah ke view
      rpl: berkasMahasiswa.dokumen_rpl || {},
      artikel: berkasMahasiswa.draft_artikel || {},
      asistensi1: berkasMahasiswa.kartu_asistensi_1 || {},
      asistensi2: berkasMahasiswa.kartu_asistensi_2 || {},
      asistensi3: berkasMahasiswa.kartu_asistensi_3 || {},
      
      berkasMahasiswa 
    });

  } catch (err) {
    console.error('❌ Error showUploadPage:', err);
    res.status(500).send('Gagal menampilkan halaman upload');
  }
};

// ==========================
// 📤 Upload file ke Supabase
// ==========================
const uploadFiles = async (req, res) => {
  try {
    const npm = req.session.user?.npm || req.body.npm;
    if (!npm) return res.status(400).json({ error: 'NPM tidak ditemukan' });

    // Cek apakah berkas sudah dikunci (ACC semua)
    const statusList = await Berkas.getStatusVerifikasiMahasiswa(npm);
    const isAlreadyDone = statusList.length > 0 && statusList.every(s => s.status_verifikasi === true);

    if (isAlreadyDone) {
        return res.status(403).send('Pendaftaran sudah diverifikasi penuh. Data dikunci.');
    }

    // Cek apakah ada file yang dikirim oleh Multer (memoryStorage)
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ error: 'Tidak ada file diupload' });
    }

    const mhs = await Mahasiswa.getMahasiswaByNPM(npm);
    if (!mhs) return res.status(404).json({ error: 'Mahasiswa tidak ditemukan' });

    // Format folder berdasarkan tahun ajaran
    const tahunFolder = mhs.nama_tahun.replace(/\//g, '-'); 
    const semesterFolder = mhs.semester.toLowerCase();

    const fieldsConfig = [
      { field: 'dokumen_rpl', jenis: 'dokumen_rpl' },
      { field: 'draft_artikel', jenis: 'draft_artikel' },
      { field: 'kartu_asistensi_1', jenis: 'kartu_asistensi_1' },
      { field: 'kartu_asistensi_2', jenis: 'kartu_asistensi_2' },
      { field: 'kartu_asistensi_3', jenis: 'kartu_asistensi_3' },
    ];

    for (const conf of fieldsConfig) {
      const fileArray = req.files[conf.field]; 
      if (!fileArray || fileArray.length === 0) continue;

      const fileObj = fileArray[0];
      const fileExt = fileObj.originalname.split('.').pop();
      const fileName = `${conf.jenis}-${Date.now()}.${fileExt}`;
      
      // Path di Supabase Bucket: berkas/2024-2025/ganjil/NPM/namafile.pdf
      const filePath = `berkas/${tahunFolder}/${semesterFolder}/${npm}/${fileName}`;

      // 1. Upload Buffer langsung ke Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('storage_sipuapi')
        .upload(filePath, fileObj.buffer, {
          contentType: fileObj.mimetype,
          upsert: true
        });

      if (uploadError) throw uploadError;

      // 2. Ambil Public URL untuk disimpan ke database
      const { data: urlData } = supabase.storage
        .from('storage_sipuapi')
        .getPublicUrl(filePath);

      // 3. Simpan link URL ke Database melalui model
      await Berkas.saveBerkasMahasiswa(npm, conf.jenis, fileObj.originalname, urlData.publicUrl);
    }

    return res.redirect('/mahasiswa/upload-berkas');

  } catch (err) {
    console.error('❌ Upload Mahasiswa Error:', err);
    res.status(500).send('Gagal upload berkas ke cloud');
  }
};

// ==========================
// 🗑️ Hapus berkas
// ==========================
const deleteFile = async (req, res) => {
  try {
    const npm = req.session.user?.npm;
    const { jenis_berkas } = req.body;

    if (!npm || !jenis_berkas) {
      return res.status(400).json({ success: false, message: 'Data tidak lengkap' });
    }

    // Cek kunci global sebelum menghapus
    const statusList = await Berkas.getStatusVerifikasiMahasiswa(npm);
    const isAlreadyDone = statusList.length > 0 && statusList.every(s => s.status_verifikasi === true);

    if (isAlreadyDone) {
      return res.status(403).json({ success: false, message: 'Akses ditolak. Berkas sudah diverifikasi penuh.' });
    }

    // Eksekusi hapus di database dan storage melalui model
    const result = await Berkas.deleteBerkas(npm, jenis_berkas);

    if (result.success) {
      return res.json({ success: true, message: 'Berhasil dihapus' });
    } else {
      return res.status(404).json({ success: false, message: result.message });
    }

  } catch (err) {
    console.error('❌ Error Controller Delete:', err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

module.exports = { showUploadPage, uploadFiles, deleteFile };