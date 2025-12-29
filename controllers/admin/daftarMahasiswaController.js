// controllers/admin/daftarMahasiswaController.js
const db = require('../../config/db.js');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');

const { Mahasiswa } = require('@models/mahasiswaModel.js');
const { TahunAjaran } = require('@models/tahunAjaranModel.js');
const { syncMahasiswaAccounts } = require('@models/akunModel.js');

/* ============================================================
   🔹 RENDER: Halaman Daftar Mahasiswa
   ============================================================ */
const renderDaftarMahasiswa = async (req, res) => {
  try {
let selectedTahunId = req.query.tahun_ajaran || req.selectedTahunId || (tahunAjarList[0]?.id);
    const mahasiswa = await Mahasiswa.getAll(selectedTahunId); 
    const tahunAjarList = await TahunAjaran.getListForSelect();

    // Tangkap query string untuk notifikasi (opsional)
    const { status, count } = req.query;
    let pesanSukses = '';
    if (status === 'success') pesanSukses = `Berhasil memproses ${count} data mahasiswa.`;

    res.render('admin/daftar-mahasiswa', {  
      title: 'Daftar Mahasiswa',  
      currentPage: 'daftar-mahasiswa',  
      role: 'admin',  
      activePage: 'daftar-mahasiswa',  
      mahasiswa,  
      tahunAjarList,  
      selectedTahunId,
      pesanSukses // Kirim pesan ke view jika ada
    });  
  } catch (err) {
    console.error('❌ ERROR renderDaftarMahasiswa:', err);
    res.status(500).send('Terjadi kesalahan saat mengambil daftar mahasiswa');
  }
};

/* ============================================================
   🔹 SINKRONISASI AKUN (Manual Trigger)
   ============================================================ */
const sinkronMahasiswa = async (req, res) => {
  try {
    const hasil = await syncMahasiswaAccounts();
    res.json({
      success: true,
      message: `Sinkronisasi selesai. Total: ${hasil.length} mahasiswa.`,
      data: hasil
    });
  } catch (err) {
    console.error('❌ ERROR sinkronMahasiswa:', err);
    res.status(500).json({ success: false, message: 'Gagal sinkronisasi akun mahasiswa.' });
  }
};

/* ============================================================
   🔥 CRUD MAHASISWA (MANUAL) 🔥
   ============================================================ */

// 1. CREATE
const createMahasiswa = async (req, res) => {
    const { npm, nama, tahun_ajaran_id } = req.body;

    try {
        // Cek NPM Ganda
        const existingNPM = await Mahasiswa.findByNPM(npm);
        if (existingNPM) {
            return res.status(409).json({ success: false, message: 'NPM Mahasiswa sudah terdaftar.' });
        }
        
        // Create Data
        await Mahasiswa.create({ npm, nama, tahun_ajaran_id });

        res.status(201).json({ success: true, message: 'Data Mahasiswa berhasil ditambahkan.' });
    } catch (err) {
        console.error('❌ ERROR createMahasiswa:', err);
        res.status(500).json({ success: false, message: 'Gagal menambahkan data mahasiswa.' });
    }
};

// 2. UPDATE
const updateMahasiswa = async (req, res) => {
    const { npm } = req.params; // NPM Lama
    const updateFields = req.body; 

    try {
        const existingMahasiswa = await Mahasiswa.getByNpm(npm);
        if (!existingMahasiswa) {
            return res.status(404).json({ success: false, message: 'Data Mahasiswa tidak ditemukan.' });
        }
        
        // Merge Data
        const dataToSave = {
            npm: updateFields.npm !== undefined ? updateFields.npm : existingMahasiswa.npm,
            nama: updateFields.nama !== undefined ? updateFields.nama : existingMahasiswa.nama,
            tahun_ajaran_id: updateFields.tahun_ajaran_id !== undefined ? updateFields.tahun_ajaran_id : existingMahasiswa.tahun_ajaran_id,
        };

        // Cek Konflik NPM Baru
        if (dataToSave.npm !== existingMahasiswa.npm) {
            const checkNPM = await Mahasiswa.findByNPM(dataToSave.npm);
            if (checkNPM) {
                return res.status(409).json({ success: false, message: 'NPM baru sudah dipakai mahasiswa lain.' });
            }
        }
        
        // Update via Model
        await Mahasiswa.updateByNpm(npm, dataToSave);

        res.status(200).json({ success: true, message: 'Data Mahasiswa berhasil diperbarui.' });
    } catch (err) {
        console.error('❌ ERROR updateMahasiswa:', err);
        res.status(500).json({ success: false, message: 'Gagal memperbarui data mahasiswa.' });
    }
};

// 3. DELETE
const deleteMahasiswa = async (req, res) => {
    const { npm } = req.params; 

    try {
        const result = await Mahasiswa.removeByNpm(npm); 

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Data Mahasiswa tidak ditemukan.' });
        }
        
        res.status(200).json({ success: true, message: 'Data Mahasiswa berhasil dihapus.' });
    } catch (err) {
        if (err.code === '23503') { 
            return res.status(409).json({ success: false, message: 'Gagal: Mahasiswa ini memiliki data terkait (Jadwal/Skripsi/dll).' });
        }
        console.error('❌ ERROR deleteMahasiswa:', err);
        res.status(500).json({ success: false, message: 'Gagal menghapus data mahasiswa.' });
    }
};


/* ============================================================
   🔹 UPLOAD EXCEL: Daftar Mahasiswa (AUTO RELOAD)
   ============================================================ */
// ... (kode sebelumnya) ...
/* ============================================================
   🔹 UPLOAD EXCEL: Daftar Mahasiswa (AUTO RELOAD)
   ============================================================ */
const uploadDaftarMahasiswa = async (req, res) => {
  try {
    console.log('\n=== [UPLOAD MAHASISWA DIMULAI] ===');

    const file = req.files?.['daftar_mahasiswa']?.[0];  
    if (!file) return res.status(400).send('File belum diupload');  

    // 1. 🔥 DEFINISIKAN DULU 'uploadDir' (INI YANG TADI HILANG/ERROR)
    const uploadDir = path.join(__dirname, '../../public/upload/admin/daftar');  
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });  

    // 2. 🔥 INSERT KE DATABASE (LOG IMPORT)
    const adminId = req.session.user?.id || null; 
    const relativePath = `/upload/admin/daftar/${file.filename}`; 

    await db.query(`
        INSERT INTO upload_excel (jenis_data, nama_file, path_file, tanggal_upload, admin_id)
        VALUES ($1, $2, $3, NOW(), $4)
    `, ['mahasiswa', file.filename, relativePath, adminId]);
    console.log('✅ Log upload mahasiswa tersimpan di DB');

    // 3. 🔥 PROSES BACA FILE
    // (Sekarang 'uploadDir' sudah aman dipakai di sini)
    // const filePath = path.join(uploadDir, file.filename); // <-- Baris ini sebenernya ga wajib kalau pake file.path dari multer
    
    // Kita baca langsung dari file.path yang disediakan Multer
    const workbook = xlsx.readFile(file.path);  
    const sheetName = workbook.SheetNames[0];  
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);  
    console.log(`📘 Sheet: ${sheetName}, Total Baris: ${data.length}`);  

    const normalize = (val) => val ? String(val).replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim() : '';  

    let processedCount = 0;

    for (const row of data) {  
      const NPM = normalize(row.NPM || row.npm);  
      const Nama = normalize(row.Nama || row.nama);  
      const Nama_Tahun = normalize(row.Nama_Tahun || row['Nama Tahun'] || row['Tahun Ajaran'] || row.nama_tahun);  
      const Semester = normalize(row.Semester || row.semester);  

      if (!NPM || !Nama || !Nama_Tahun || !Semester) continue;  

      // Cari ID Tahun Ajaran
      const tahunRes = await db.query('SELECT id FROM tahun_ajaran WHERE nama_tahun = $1 AND semester = $2', [Nama_Tahun, Semester]);  
      const tahunAjaranId = tahunRes.rows[0]?.id;  
      
      if (!tahunAjaranId) {  
        console.warn(`⚠️ Tahun ajaran ${Nama_Tahun} ${Semester} tidak ditemukan. Skip NPM ${NPM}.`);  
        continue;  
      }  

      const existing = await Mahasiswa.findByNPM(NPM);  

      if (existing) {  
        await Mahasiswa.updateByNpm(NPM, { npm: NPM, nama: Nama, tahun_ajaran_id: tahunAjaranId });  
      } else {  
        await Mahasiswa.create({ npm: NPM, nama: Nama, tahun_ajaran_id: tahunAjaranId });  
      }
      processedCount++;
    }  

    console.log('=== [UPLOAD MAHASISWA SELESAI] ===\n');  

    return res.redirect(`/admin/daftar-mahasiswa?status=success&count=${processedCount}`);

  } catch (err) {
    console.error('❌ ERROR uploadDaftarMahasiswa:', err);
    res.status(500).send('Terjadi kesalahan saat upload excel.');
  }
};

/* ============================================================
   🔹 EXPORT MODULE
   ============================================================ */
module.exports = {
  renderDaftarMahasiswa,
  sinkronMahasiswa,
  uploadDaftarMahasiswa,
  createMahasiswa,
  updateMahasiswa,
  deleteMahasiswa
};