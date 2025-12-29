// controllers/admin/daftarDosenController
const { Dosen } = require('../../models/dosenModel');
const supabase = require('../../config/supabaseClient'); // Import client Supabase
const pool = require('../../config/db');
const xlsx = require('xlsx');

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
// UPLOAD: File Excel Daftar Dosen (VERSI VERCEL & SUPABASE)
// ===============================
const uploadDaftarDosen = async (req, res) => {
  try {
    const file = req.files?.['daftar_dosen']?.[0];
    if (!file) return res.status(400).send('File belum diupload');

    // 1. PROSES BACA EXCEL DARI BUFFER (RAM)
    const workbook = xlsx.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    for (const row of data) {
      const normalize = (val) => (val ? String(val).trim() : '');

      // NIP otomatis disatukan tanpa spasi atau tanda baca
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

    // 🔥 PENTING: Sync Akun Kaprodi dipanggil di sini
    await Dosen.syncKaprodiAccounts(); 

    // 2. UPLOAD ARSIP KE SUPABASE STORAGE
    const fileName = `dosen-${Date.now()}-${file.originalname}`;
    const filePath = `upload_excel/dosen/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('storage_sipuapi')
        .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: true
        });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from('storage_sipuapi').getPublicUrl(filePath);

    // 3. LOG IMPORT KE DATABASE
    const adminId = req.session.user?.id || null;
    await pool.query(`
        INSERT INTO upload_excel (jenis_data, nama_file, path_file, tanggal_upload, admin_id)
        VALUES ($1, $2, $3, NOW(), $4)
    `, ['dosen', fileName, urlData.publicUrl, adminId]);

    // Ambil data terbaru untuk dirender ulang
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
    res.status(500).send('Terjadi kesalahan saat memproses file Excel dosen');
  }
};

// ===============================
// CREATE: Tambah Dosen Baru
// ===============================
const createDosen = async (req, res) => {
    const { nip_dosen, nama, status_aktif, jabatan, kode_dosen } = req.body;
    try {
        const existingNIP = await Dosen.exists(nip_dosen);
        if (existingNIP) {
            return res.status(409).json({ success: false, message: 'NIP Dosen sudah terdaftar.' });
        }
        const existingKode = await Dosen.existsKode(kode_dosen); 
        if (existingKode) {
            return res.status(409).json({ success: false, message: 'Kode Dosen sudah terdaftar.' });
        }
        
        await Dosen.insert({ 
            nip_dosen, 
            nama, 
            status_aktif: status_aktif === 'true', 
            jabatan, 
            kode_dosen 
        });

        await Dosen.syncKaprodiAccounts();
        res.status(201).json({ success: true, message: 'Data Dosen berhasil ditambahkan.' });
    } catch (err) {
        console.error('❌ ERROR createDosen:', err);
        res.status(500).json({ success: false, message: 'Gagal menambahkan data dosen.' });
    }
};

// ===============================
// UPDATE: Edit Data Dosen
// ===============================
const updateDosen = async (req, res) => {
    const { kodeDosen } = req.params;
    const updateFields = req.body; 

    try {
        const existingDosen = await Dosen.getByKodeDosen(kodeDosen); 
        if (!existingDosen) {
            return res.status(404).json({ success: false, message: 'Data Dosen tidak ditemukan.' });
        }
        
        const currentId = existingDosen.id;
        const dataToSave = {
            nip_dosen: updateFields.nip_dosen !== undefined ? updateFields.nip_dosen : existingDosen.nip_dosen,
            nama: updateFields.nama !== undefined ? updateFields.nama : existingDosen.nama,
            status_aktif: updateFields.status_aktif !== undefined 
                          ? (updateFields.status_aktif === 'true' || updateFields.status_aktif === true) 
                          : existingDosen.status_aktif,
            jabatan: updateFields.jabatan !== undefined ? updateFields.jabatan : existingDosen.jabatan,
            kode_dosen: updateFields.kode_dosen !== undefined ? updateFields.kode_dosen : existingDosen.kode_dosen, 
        };

        const checkNIP = await Dosen.exists(dataToSave.nip_dosen, currentId);
        if (checkNIP && String(checkNIP) !== String(currentId)) {
            return res.status(409).json({ success: false, message: 'NIP Dosen sudah terdaftar pada dosen lain.' });
        }
        
        const checkKode = await Dosen.existsKode(dataToSave.kode_dosen, currentId);
        if (checkKode && String(checkKode) !== String(currentId)) {
            return res.status(409).json({ success: false, message: 'Kode Dosen baru sudah terdaftar pada dosen lain.' });
        }
        
        await Dosen.updateByKodeDosen(kodeDosen, dataToSave);
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