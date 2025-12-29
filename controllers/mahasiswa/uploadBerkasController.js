// controllers/mahasiswa/uploadBerkasController.js
const { Berkas } = require('../../models/berkasModel.js');
const { Mahasiswa } = require('../../models/mahasiswaModel.js');
const { Status } = require('../../models/statusModel.js'); 
const sharp = require('sharp'); // 📦 Panggil tukang pres

// ==========================
// 🔧 HELPER: Kompres Gambar
// ==========================
// ==========================
// 🔧 HELPER: Kompres Gambar (VERSI AMAN WINDOWS)
// ==========================
const compressImage = async (filePath) => {
    try {
        const ext = path.extname(filePath).toLowerCase();
        // Cek apakah ini gambar yang didukung
        if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) return;

        // 1. BACA FILE KE RAM DULU (Biar file asli bisa diutak-atik)
        const fileBuffer = fs.readFileSync(filePath);

        // 2. PROSES DI RAM
        const compressedBuffer = await sharp(fileBuffer)
            .resize(1500, null, { 
                fit: 'inside',
                withoutEnlargement: true 
            })
            .jpeg({ quality: 80, mozjpeg: true })
            .toBuffer(); // Jadikan buffer lagi

        // 3. TIMPA FILE ASLI (Aman karena kita cuma pegang buffer sekarang)
        fs.writeFileSync(filePath, compressedBuffer);
        
        console.log(`✅ Berhasil kompres: ${path.basename(filePath)}`);

    } catch (error) {
        console.error('⚠️ Gagal kompres gambar (File asli tetap aman):', error.message);
        // Jangan throw error, biar upload tetap dianggap sukses walau gagal kompres
    }
};

// ==========================
// 📄 Render halaman upload
// ==========================
const showUploadPage = async (req, res) => {
  try {
    if (!req.session.user) return res.status(403).send('Akses ditolak');

    const npm = req.session.user.npm;
    const mhs = await Mahasiswa.getMahasiswaByNPM(npm);
    
    // 1. AMBIL DATA MENTAH (Array dari Database)
    const rawBerkas = await Berkas.getBerkasByMahasiswa(npm); 

    // 2. 🔄 KONVERSI ARRAY KE OBJECT (Mapping)
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

    // Status badge upload (Cek apakah minimal RPL atau Artikel sudah ada)
    const sudahUpload = berkasMahasiswa.dokumen_rpl?.path || 
                        berkasMahasiswa.draft_artikel?.path || 
                        // Cek salah satu bukti asistensi
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
      dosbing1: mhs.dosbing1,
      dosbing2: mhs.dosbing2,
      badge,
      
      // 👇 KIRIM DATA TERPISAH (Biar EJS gampang bacanya)
      rpl: berkasMahasiswa.dokumen_rpl || {},
      artikel: berkasMahasiswa.draft_artikel || {},
      
      // Data Asistensi Dipecah 3
      asistensi1: berkasMahasiswa.kartu_asistensi_1 || {},
      asistensi2: berkasMahasiswa.kartu_asistensi_2 || {},
      asistensi3: berkasMahasiswa.kartu_asistensi_3 || {},
      
      berkasMahasiswa // Backup raw object
    });

  } catch (err) {
    console.error('❌ Error showUploadPage:', err);
    res.status(500).send('Gagal menampilkan halaman upload');
  }
};

// ==========================
// 📤 Upload file mahasiswa
// ==========================
const uploadFiles = async (req, res) => {
  try {
    const npm = req.session.user?.npm || req.body.npm;
    if (!npm) return res.status(400).json({ error: 'NPM tidak ditemukan' });

    // 🔥 LOGIKA GLOBAL LOCK: Ambil status semua berkas yang ada
    const statusList = await Berkas.getStatusVerifikasiMahasiswa(npm);
    
    // Syarat kunci: Ada berkas yang diupload DAN semuanya bernilai true (ACC)
    const isAlreadyDone = statusList.length > 0 && statusList.every(s => s.status_verifikasi === true);

    if (isAlreadyDone) {
        return res.status(403).send('Pendaftaran sudah diverifikasi penuh. Data dikunci.');
    }

    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ error: 'Tidak ada file diupload' });
    }

    // ... sisa kode upload lo tetap sama ...

    const mhs = await Mahasiswa.getMahasiswaByNPM(npm);
    if (!mhs) return res.status(404).json({ error: 'Mahasiswa tidak ditemukan' });

    // 👇 CONFIG: Daftar field yang mungkin diupload
    const fieldsConfig = [
      { field: 'dokumen_rpl', jenis: 'dokumen_rpl' },
      { field: 'draft_artikel', jenis: 'draft_artikel' },
      // 👇 KITA PECAH JADI 3 JENIS BERKAS BERBEDA DI DB
      { field: 'kartu_asistensi_1', jenis: 'kartu_asistensi_1' },
      { field: 'kartu_asistensi_2', jenis: 'kartu_asistensi_2' },
      { field: 'kartu_asistensi_3', jenis: 'kartu_asistensi_3' },
    ];

    let successCount = 0;

    // Loop setiap config, cek apakah ada file yg diupload untuk field itu
    for (const conf of fieldsConfig) {
      const fileArray = req.files[conf.field]; // Ambil dari req.files['nama_field']
      
      // Kalau user gak upload field ini, skip
      if (!fileArray || fileArray.length === 0) continue;

      const fileObj = fileArray[0];
      const filePath = `/upload/mahasiswa/${npm}/${fileObj.filename}`;
      const fileName = fileObj.originalname;

      // 🧩 Simpan ke Database
      // Logic ini akan otomatis UPDATE kalau sudah ada, atau INSERT kalau belum
      await Berkas.saveBerkasMahasiswa(npm, conf.jenis, fileName, filePath);
      successCount++;
    }

    // ✅ Redirect balik biar halaman refresh
    return res.redirect('/mahasiswa/upload-berkas');

  } catch (err) {
    console.error('❌ Upload Mahasiswa Error:', err);
    res.status(500).send('Gagal upload berkas');
  }
};

const deleteFile = async (req, res) => {
  try {
    const npm = req.session.user?.npm;
    const { jenis_berkas } = req.body;

    if (!npm || !jenis_berkas) {
      return res.status(400).json({ success: false, message: 'Data tidak lengkap' });
    }

    // 🔥 LOGIKA GLOBAL LOCK: Cek apakah sudah ACC semua
    const statusList = await Berkas.getStatusVerifikasiMahasiswa(npm);
    const isAlreadyDone = statusList.length > 0 && statusList.every(s => s.status_verifikasi === true);

    if (isAlreadyDone) {
      return res.status(403).json({ success: false, message: 'Akses ditolak. Berkas sudah diverifikasi penuh.' });
    }

    const result = await Berkas.deleteBerkas(npm, jenis_berkas);
    // ... sisa kode delete lo ...

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

module.exports = { compressImage, showUploadPage, uploadFiles, deleteFile };