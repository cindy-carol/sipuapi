// controllers/admin/verifikasiController.js
const Verifikasi = require('../../models/verifikasiModel');
const puppeteer = require('puppeteer');
const SuratModel = require('../../models/suratUndanganModel'); 
const AturSurat = require('../../models/aturSuratModel'); 
const path = require('path');
const fs = require('fs');
const pool = require('../../config/db'); 
const { Mahasiswa } = require('../../models/mahasiswaModel');
const supabase = require('../../config/supabaseClient'); 

const verifikasiController = {
  
  // =========================================================================
  // 🚀 1. LIST DATA (TAB VERIFIKASI)
  // =========================================================================
  listAll: async (req, res) => {
    try {
      const tahunId = req.query.tahun || null;
      const activeTab = req.query.tab || 'berkas'; 

      let berkas = [], jadwal = [], surat = [], selesai = [];

      switch (activeTab) {
        case 'berkas':
          const rawBerkas = await Verifikasi.verifBerkas(tahunId);
          berkas = rawBerkas.map(m => ({
            nama: m.nama, npm: m.npm, nama_tahun: m.nama_tahun, semester: m.semester,
            total_berkas: m.total_berkas, total_verif_true: m.total_verif_true,
            id: m.mahasiswa_id || m.id, 
            status: parseInt(m.total_verif_true) === parseInt(m.total_berkas) ? 'Terverifikasi' : 'Belum Selesai'
          }));
          break;

case 'jadwal':
  const rawJadwal = await Verifikasi.verifJadwal(tahunId);
  jadwal = rawJadwal.map(j => {
    // Gabungkan tanggal dan jam secara manual jika formattedJadwal tidak ada
    const tanggal = j.tanggal ? new Date(j.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
    const jam = (j.jam_mulai && j.jam_selesai) ? `${j.jam_mulai.slice(0, 5)} - ${j.jam_selesai.slice(0, 5)} WIB` : '';
    
    const jadwalLengkap = (tanggal && jam) ? `${tanggal}, ${jam}` : '-';

    return {
      id: j.jadwal_id, 
      nama: j.nama, 
      npm: j.npm, 
      nama_tahun: j.nama_tahun, 
      semester: j.semester,
      dosbing1: j.dosbing1 || '-', 
      dosbing2: j.dosbing2 || '-', 
      pelaksanaan: j.pelaksanaan || '-',
      tempat: j.tempat || '-', 
      jadwalUjian: j.formattedJadwal || jadwalLengkap, // Gunakan manual jika query kosong
      status: j.status_verifikasi ? 'Terverifikasi' : 'Menunggu Verifikasi'
    };
  });
  break;

        case 'surat':
          const [rawSurat, rawJadwalForSurat] = await Promise.all([
            Verifikasi.suratUndangan(tahunId),
            Verifikasi.verifJadwal(tahunId) 
          ]);
          const jadwalMap = {};
          rawJadwalForSurat.forEach(j => { jadwalMap[j.npm] = j; });
          surat = rawSurat.map(s => {
            const jMhs = jadwalMap[s.npm] || {}; 
            return {
              nama: s.nama, npm: s.npm, nama_tahun: s.nama_tahun, semester: s.semester,
              suratUndanganPath: s.path_file || '#', nama_surat: s.nama_surat || '-',
              is_diterbitkan: s.is_diterbitkan, last_download_at: s.last_download_at,
              jadwal: { pelaksanaan: jMhs.pelaksanaan || 'offline', tanggal: jMhs.tanggal || '', tempat: jMhs.tempat || '' },
              dosbing1: jMhs.dosbing1 || '-', dosbing2: jMhs.dosbing2 || '-',
              penguji: [ jMhs.dosen_penguji_id ? 'Sudah Ditunjuk' : '' ]
            };
          });
          break;

        case 'selesai':
          const rawSelesai = await Verifikasi.selesaiUjian(tahunId);
          selesai = rawSelesai.map(s => ({
            id: s.mahasiswa_id || s.id, nama: s.nama, npm: s.npm, nama_tahun: s.nama_tahun, semester: s.semester,
            dosbing1: s.dosbing1 || '-', dosbing2: s.dosbing2 || '-', jadwalUjian: s.formattedJadwal || '-',
            status_keseluruhan: s.status_keseluruhan ? 'Selesai' : 'Menunggu Konfirmasi'
          }));
          break;
      }

      res.render('admin/verifikasi', { title: 'Verifikasi Pendaftaran', currentPage: 'verifikasi', role: 'admin', activeTab, tahunId, berkas, jadwal, surat, selesai });
    } catch (err) {
      res.status(500).send('Server Error: ' + err.message);
    }
  },

  // =========================================================================
  // 📤 UPLOAD SURAT TTD KE SUPABASE STORAGE (AMALAN VERCEL)
  // =========================================================================
  uploadSuratTTD: async (req, res) => {
    try {
      const npm = req.params.npm; 
      const file = req.file;
      if (!file) throw new Error("File surat tidak ditemukan.");

      // Folder: surat/[NPM]/Undangan-TTD-[Timestamp].pdf
      const filePath = `surat/${npm}/Undangan-TTD-${Date.now()}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from('storage_sipuapi')
        .upload(filePath, file.buffer, { contentType: 'application/pdf', upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('storage_sipuapi').getPublicUrl(filePath);
      await SuratModel.uploadSuratFinal(npm, urlData.publicUrl, req.session.user?.id);
      
      res.redirect('/admin/verifikasi?tab=surat');
    } catch (err) {
      res.status(500).send(err.message);
    }
  },

  // =========================================================================
  // 🗑️ HAPUS SURAT (CLOUD SYNC)
  // =========================================================================
  deleteSuratTTD: async (req, res) => {
    try {
      const { npm } = req.body;
      const oldData = await SuratModel.getSuratByMahasiswa(npm); 

      if (oldData && oldData.path_file && oldData.path_file.includes('supabase')) {
          const cleanPath = oldData.path_file.split('storage_sipuapi/').pop();
          await supabase.storage.from('storage_sipuapi').remove([cleanPath]);
      }

      await SuratModel.deleteSuratFile(npm);
      res.json({ success: true, message: 'File surat di cloud berhasil dihapus.' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // =========================================================================
  // 🖨️ GENERATE PDF (PUPPETEER)
  // =========================================================================
  generateUndanganPDF: async (req, res) => {
    try {
      const { npm } = req.params;
      await Verifikasi.markSuratDownloaded(npm);
      const data = await SuratModel.getSuratByMahasiswa(npm); 
      if (!data) return res.status(404).send('Data tidak ditemukan.');

      const templateSettings = await AturSurat.getSettings('undangan');
      
      const logoPathFile = path.join(process.cwd(), 'public', 'images', 'unila1.png');
      const logoBuffer = fs.readFileSync(logoPathFile);
      const logoBase64 = logoBuffer.toString('base64');

      const html = await new Promise((resv, rej) => {
        res.render('partials/surat-undangan', { 
          layout: false, 
          ...data, 
          logoPath: `data:image/png;base64,${logoBase64}`,
          kopSurat: templateSettings.kop_surat_text, 
          kalimatPembuka: templateSettings.pembuka, 
          isi: templateSettings.isi, 
          kalimatPenutup: templateSettings.penutup 
        }, (err, h) => err ? rej(err) : resv(h));
      });

      const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-setuid-sandbox'] });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
      await browser.close();

      res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="Surat-${npm}.pdf"` });
      res.send(pdfBuffer);
    } catch (err) {
      res.status(500).send(err.message);
    }
  },

  // =========================================================================
  // ⚙️ SETTINGS TEMPLATE (MEMPERBAIKI ERROR TYPEERROR ROUTER)
  // =========================================================================
  getTemplateSettings: async (req, res) => {
    try {
      const settings = await AturSurat.getSettings('undangan');
      res.json({ success: true, data: settings });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  saveTemplateSettings: async (req, res) => {
    try {
      const { kop_surat_text, pembuka, isi, penutup } = req.body;
      await AturSurat.updateSettings({ jenis_surat: 'undangan', kop_surat_text, pembuka, isi, penutup });
      res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getSuratDetail: async (req, res) => {
    try {
      const { npm } = req.params;
      const { rows } = await pool.query(`SELECT m.id AS mahasiswa_id, j.id AS jadwal_id, j.tanggal, j.pelaksanaan FROM mahasiswa m LEFT JOIN jadwal j ON j.mahasiswa_id = m.id WHERE m.npm = $1`, [npm]);
      res.json({ success: true, data: rows[0] });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  updateSuratDetail: async (req, res) => {
    try {
      const { jadwalId } = req.params;
      const { mahasiswaId, tanggal, jam_mulai, jam_selesai, pelaksanaan, tempat, link_zoom, meeting_id, passcode, dosen_penguji_id } = req.body;
      await Verifikasi.updateJadwal(jadwalId, { tanggal, jam_mulai, jam_selesai, pelaksanaan, tempat, link_zoom, meeting_id, passcode, editorId: req.session.user?.id });
      if (dosen_penguji_id) await Verifikasi.updateDosenPenguji(mahasiswaId, dosen_penguji_id, req.session.user?.id);
      await Verifikasi.resetStatusSurat(mahasiswaId, req.session.user?.id);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getDosenList: async (req, res) => {
    const dosen = await Verifikasi.getAllDosen();
    res.json({ success: true, data: dosen });
  },

  tandaiSelesai: async (req, res) => {
    await Verifikasi.tandaiSelesai(req.body.mahasiswaId, req.session.user?.id);
    res.json({ success: true });
  },

  operKeKaprodi: async (req, res) => {
    try {
      const mId = await Verifikasi.updateStatusVerifikasi(req.body.jadwalId, true, req.session.user?.id);
      await Verifikasi.operKeKaprodi(mId); 
      res.redirect('/admin/verifikasi?tab=jadwal'); 
    } catch (err) { res.status(500).send(err.message); }
  }
};

module.exports = verifikasiController;