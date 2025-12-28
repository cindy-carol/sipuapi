const multer = require('multer');
const path = require('path');
const fs = require('fs');

// =======================
// 🗂️ Base Upload Directory
// =======================
const baseUploadDir = path.join(__dirname, '../public/upload/mahasiswa');

// Pastikan folder upload ada
function ensureDirExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ==========================================================
// 👨‍🎓 MAHASISWA UPLOAD CONFIG (PER NPM)
// ==========================================================
const mahasiswaBaseDir = path.join(baseUploadDir, 'mahasiswa');

const mahasiswaFolderMap = {
  dokumen_rpl: '01_dokumen_rpl',
  draft_artikel: '02_draft_artikel',
  kartu_asistensi: '03_kartu_asistensi', // ✅ perbaiki biar cocok dgn fieldname EJS
  lainnya: 'lainnya',
};

// Buka file: upload.js

// ... kode sebelumnya ...

const storageMahasiswa = multer.diskStorage({
  destination: (req, file, cb) => {
    const npm = req.session.user?.npm || req.body.npm || 'nonpm';
    const folderPath = path.join(baseUploadDir, npm);
    ensureDirExists(folderPath);
    cb(null, folderPath);
  },
  filename: (req, file, cb) => {
    const npm = req.session.user?.npm || 'nonpm';
    const ext = path.extname(file.originalname);
    const cleanField = file.fieldname.replace(/\s+/g, '-').toLowerCase();
    
    // --- PERUBAHAN DI SINI ---
    // Khusus kartu_asistensi, kasih timestamp biar file 1, 2, 3 gak saling timpa
    if (cleanField === 'kartu_asistensi') {
        cb(null, `${npm}-${cleanField}-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`);
    } else {
        // RPL & Artikel tetap format lama (konsisten)
        cb(null, `${npm}-${cleanField}${ext}`);
    }
  }
});

// ... sisanya sama ...

const uploadMahasiswa = multer({ storage: storageMahasiswa });

// ==========================================================
// 🧑‍💼 ADMIN UPLOAD CONFIG (tetap sama)
// ==========================================================
const adminBaseDir = path.join(baseUploadDir, 'admin');

const adminFolderMap = {
  format_rpl: 'format_dokumen',
  format_artikel: 'format_dokumen',
  format_asistensi: 'format_dokumen',
  daftar_mahasiswa: 'daftar',
  daftar_dosen: 'daftar',
  daftar_dosbing: 'daftar',

  surat_undangan: 'surat_undangan_ttd',

  lainnya: 'lainnya',
};

const storageAdmin = multer.diskStorage({
  destination: (req, file, cb) => {
    const subfolder = adminFolderMap[file.fieldname] || 'lainnya';
    const fullDir = path.join(adminBaseDir, subfolder);
    ensureDirExists(fullDir);
    cb(null, fullDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const cleanField = file.fieldname.replace(/\s+/g, '-').toLowerCase();
    const npm = req.params.npm || req.body.npm || 'unknown';

    if (['format_rpl', 'format_artikel', 'format_asistensi'].includes(file.fieldname)) {
      cb(null, `${cleanField}${ext}`);
    } else if (['daftar_mahasiswa', 'daftar_dosen', 'daftar_dosbing'].includes(file.fieldname)) {
      cb(null, `${Date.now()}-${file.originalname}`);
    } else if (file.fieldname === 'surat_undangan') {
      cb(null, `Surat-Undangan-${npm}${ext}`);
    } else {
      cb(null, `${cleanField}-${Date.now()}${ext}`);
    }
  },
});

const uploadAdmin = multer({ storage: storageAdmin });

// ==========================================================
// 🚀 EXPORTS
// ==========================================================
module.exports = {
  uploadMahasiswa,
  uploadAdmin,
};
