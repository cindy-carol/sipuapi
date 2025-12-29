// controllers/admin/daftarDosenController
const { Dosen } = require('../../models/dosenModel');
const pool = require('../../config/db');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

// ===============================
// RENDER: Halaman Daftar Dosen
// ===============================
const renderDaftarDosen = async (req, res) => {
  try {
    const dosen = await Dosen.getAll();
    res.render('admin/daftar-dosen', {
      title: 'Daftar Dosen',
      currentPage: 'daftar-dosen',
      role: 'admin',
      activePage: 'daftar-dosen',
      dosen
    });
  } catch (err) {
    console.error('❌ ERROR renderDaftarDosen:', err);
    res.status(500).send('Terjadi kesalahan saat mengambil daftar dosen');
  }
};

// ===============================
// UPLOAD: File Excel Daftar Dosen
// ===============================
const uploadDaftarDosen = async (req, res) => {
  try {
    const file = req.files?.['daftar_dosen']?.[0];
    if (!file) return res.status(400).send('File belum diupload');

    // pastikan folder upload ada
    const uploadDir = path.join(__dirname, '../../public/upload/admin/daftar-dosen');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, file.originalname);
    fs.renameSync(file.path, filePath);

    const adminId = req.session.user?.id || null;
    // Note: Karena logikamu me-rename file jadi originalName, kita catat itu
    const finalFileName = file.originalname; 
    const relativePath = `/upload/admin/daftar-dosen/${finalFileName}`;

    await pool.query(`
        INSERT INTO upload_excel (jenis_data, nama_file, path_file, tanggal_upload, admin_id)
        VALUES ($1, $2, $3, NOW(), $4)
    `, ['dosen', finalFileName, relativePath, adminId]);

    // proses excel
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    for (const row of data) {
      const normalize = (val) => (val ? String(val).trim() : '');

      // 💡 NIP otomatis disatukan tanpa spasi atau tanda baca
      const nip_dosen = normalize(row.NIP || row.nip_dosen).replace(/\D+/g, ''); 

      const nama = normalize(row.Nama || row.nama);
      const statusAktifRaw = normalize(row.Status_Aktif || row.status_aktif);
      let jabatan = normalize(row.Jabatan || row.jabatan);
      const kode_dosen = normalize(row.Kode_Dosen || row.kode_dosen);

      if (!nip_dosen || !nama) continue;

      // ===== Atur status_aktif otomatis =====
      const status_aktif = statusAktifRaw
        ? ['true', 'aktif', '1'].includes(statusAktifRaw.toLowerCase())
        : true; 

      // ===== Atur jabatan otomatis =====
      jabatan = jabatan.toLowerCase().includes('kaprodi') ? 'Kaprodi' : 'Dosen';

      const existingId = await Dosen.exists(nip_dosen);
      if (existingId) {
        await Dosen.update({ nip_dosen, nama, status_aktif, jabatan, kode_dosen });
      } else {
        await Dosen.insert({ nip_dosen, nama, status_aktif, jabatan, kode_dosen });
      }
    }

    // 🔥 PENTING: Sync Akun Kaprodi dipanggil di sini (Setelah semua loop selesai)
    await Dosen.syncKaprodiAccounts(); 

    const dosen = await Dosen.getAll();
    res.render('admin/daftar-dosen', {
      title: 'Daftar Dosen',
      currentPage: 'daftar-dosen',
      role: 'admin',
      activePage: 'daftar-dosen',
      dosen,
      message: 'Upload Excel berhasil dan data sudah disimpan di database'
    });

  } catch (err) {
    console.error('❌ ERROR uploadDaftarDosen:', err);
    res.status(500).send('Terjadi kesalahan saat upload daftar dosen');
  }
};

// ===============================
// CREATE: Tambah Dosen Baru (dari Modal/Form)
// ===============================
const createDosen = async (req, res) => {
    // Data dikirim dari Form/Modal via POST
    const { nip_dosen, nama, status_aktif, jabatan, kode_dosen } = req.body;

    try {
        // 1. Validasi Keunikan NIP/Kode Dosen
        const existingNIP = await Dosen.exists(nip_dosen);
        if (existingNIP) {
            return res.status(409).json({ success: false, message: 'NIP Dosen sudah terdaftar.' });
        }
        const existingKode = await Dosen.existsKode(kode_dosen); 
        if (existingKode) {
            return res.status(409).json({ success: false, message: 'Kode Dosen sudah terdaftar.' });
        }
        
        // 2. Insert Data
        await Dosen.insert({ 
            nip_dosen, 
            nama, 
            status_aktif: status_aktif === 'true', 
            jabatan, 
            kode_dosen 
        });

        // 🔥 PENTING: Sync Akun Kaprodi dipanggil di sini (Setelah insert sukses)
        await Dosen.syncKaprodiAccounts();

        res.status(201).json({ success: true, message: 'Data Dosen berhasil ditambahkan.' });
    } catch (err) {
        console.error('❌ ERROR createDosen:', err);
        res.status(500).json({ success: false, message: 'Gagal menambahkan data dosen.' });
    }
};

// ===============================
// UPDATE: Edit Data Dosen (Inline Edit)
// ===============================
const updateDosen = async (req, res) => {
    const { kodeDosen } = req.params; // Ini adalah KODE DOSEN LAMA
    const updateFields = req.body; 

    try {
        // 1. Ambil data dosen yang sudah ada
        const existingDosen = await Dosen.getByKodeDosen(kodeDosen); 

        if (!existingDosen) {
            return res.status(404).json({ success: false, message: 'Data Dosen tidak ditemukan.' });
        }
        
        const currentId = existingDosen.id;
        
        // 2. Gabungkan data lama dan baru
        const dataToSave = {
            nip_dosen: updateFields.nip_dosen !== undefined ? updateFields.nip_dosen : existingDosen.nip_dosen,
            nama: updateFields.nama !== undefined ? updateFields.nama : existingDosen.nama,
            status_aktif: updateFields.status_aktif !== undefined 
                          ? (updateFields.status_aktif === 'true' || updateFields.status_aktif === true) 
                          : existingDosen.status_aktif,
            jabatan: updateFields.jabatan !== undefined ? updateFields.jabatan : existingDosen.jabatan,
            kode_dosen: updateFields.kode_dosen !== undefined ? updateFields.kode_dosen : existingDosen.kode_dosen, 
        };

        // 3. Validasi Keunikan
        const checkNIP = await Dosen.exists(dataToSave.nip_dosen, currentId);
        if (checkNIP && String(checkNIP) !== String(currentId)) {
            return res.status(409).json({ success: false, message: 'NIP Dosen sudah terdaftar pada dosen lain.' });
        }
        
        const checkKode = await Dosen.existsKode(dataToSave.kode_dosen, currentId);
        if (checkKode && String(checkKode) !== String(currentId)) {
            return res.status(409).json({ success: false, message: 'Kode Dosen baru sudah terdaftar pada dosen lain.' });
        }
        
        // 4. Update Data ke database
        await Dosen.updateByKodeDosen(kodeDosen, dataToSave);

        // 🔥 PENTING: Sync Akun Kaprodi dipanggil di sini (Setelah update sukses)
        await Dosen.syncKaprodiAccounts();

        res.status(200).json({ success: true, message: 'Data Dosen berhasil diperbarui.' });
    } catch (err) {
        console.error('❌ ERROR updateDosen:', err);
        res.status(500).json({ success: false, message: 'Gagal memperbarui data dosen.' });
    }
};

// ===============================
// DELETE: Hapus Data Dosen
// ===============================
const deleteDosen = async (req, res) => {
    const { kodeDosen } = req.params; 

    try {
        const result = await Dosen.removeByKodeDosen(kodeDosen); 

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Data Dosen tidak ditemukan.' });
        }
        
        res.status(200).json({ success: true, message: 'Data Dosen berhasil dihapus.' });
    } catch (err) {
        if (err.code === '23503') {
            return res.status(409).json({ success: false, message: 'Dosen tidak dapat dihapus karena masih terkait dengan data lain.' });
        }
        
        console.error('❌ ERROR deleteDosen:', err);
        res.status(500).json({ success: false, message: 'Gagal menghapus data dosen.' });
    }
};

module.exports = {
  renderDaftarDosen,
  uploadDaftarDosen,
  createDosen,
  updateDosen,
  deleteDosen
};