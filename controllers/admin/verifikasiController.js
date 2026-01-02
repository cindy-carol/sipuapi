// controllers/admin/verifikasiController.js
const Verifikasi = require('../../models/verifikasiModel');
const SuratModel = require('../../models/suratUndanganModel'); 
const AturSurat = require('../../models/aturSuratModel'); 
const path = require('path');
const fs = require('fs');
const pool = require('../../config/db'); 
const { Mahasiswa } = require('../../models/mahasiswaModel');
const supabase = require('../../config/supabaseClient'); 

// 🔥 WAJIB ADA UNTUK VERCEL
const ejs = require('ejs'); 
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const verifikasiController = {
  
  // =========================================================================
  // 🚀 1. LIST DATA (OPTIMIZED: SERVER-SIDE TABS)
  // =========================================================================
  listAll: async (req, res) => {
    try {
      console.time('⏱️ WAKTU LOAD TAB'); 
      
      const tahunId = req.query.tahun || null;
      const activeTab = req.query.tab || 'berkas'; 

      let berkas = [], jadwal = [], surat = [], selesai = [];

      // 🔥 SWITCH CASE: CUMA LOAD DATA YANG DIBUTUHKAN
      switch (activeTab) {
        
        // ---------------------------------------------------------------
        // CASE 1: TAB VERIFIKASI BERKAS
        // ---------------------------------------------------------------
        case 'berkas':
          const rawBerkas = await Verifikasi.verifBerkas(tahunId);
          berkas = rawBerkas.map(m => ({
            nama: m.nama,
            npm: m.npm,
            nama_tahun: m.nama_tahun,
            semester: m.semester,
            total_berkas: m.total_berkas,
            total_verif_true: m.total_verif_true,
            id: m.mahasiswa_id || m.id, 
            status: parseInt(m.total_verif_true) === parseInt(m.total_berkas) ? 'Terverifikasi' : 'Belum Selesai'
          }));
          break;

        // ---------------------------------------------------------------
        // CASE 2: TAB VERIFIKASI JADWAL
        // ---------------------------------------------------------------
        case 'jadwal':
          const rawJadwal = await Verifikasi.verifJadwal(tahunId);
          jadwal = rawJadwal.map(j => {
            let jadwalDisplay = '-';
            if (j.tanggal) {
                const dateObj = new Date(j.tanggal);
                const tanggalSingkat = dateObj.toLocaleDateString('id-ID', {
                    weekday: 'long', day: 'numeric', month: 'short', year: 'numeric'
                });
                const mulai = j.jam_mulai ? j.jam_mulai.toString().slice(0, 5) : '';
                const selesai = j.jam_selesai ? j.jam_selesai.toString().slice(0, 5) : '';
                jadwalDisplay = `${tanggalSingkat}<br>${mulai} s/d ${selesai} WIB`;
            } else {
                jadwalDisplay = j.formattedJadwal || '-';
            }
    
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
                jadwalUjian: jadwalDisplay,
                status: j.status_verifikasi ? 'Terverifikasi' : 'Menunggu Verifikasi'
            };
          });
          break;

        // ---------------------------------------------------------------
        // CASE 3: TAB DOWNLOAD SURAT
        // ---------------------------------------------------------------
        case 'surat':
          const [rawSurat, rawJadwalForSurat] = await Promise.all([
            Verifikasi.suratUndangan(tahunId),
            Verifikasi.verifJadwal(tahunId) 
          ]);

          const jadwalMap = {};
          rawJadwalForSurat.forEach(j => { jadwalMap[j.npm] = j; });

          surat = rawSurat.map(s => {
            const jadwalMhs = jadwalMap[s.npm] || {}; 
            return {
              nama: s.nama,
              npm: s.npm,
              nama_tahun: s.nama_tahun,
              semester: s.semester,
              suratUndanganPath: s.path_file || '#',
              nama_surat: s.nama_surat || '-',
              is_diterbitkan: s.is_diterbitkan,
              last_download_at: s.last_download_at,              
              jadwal: {
                pelaksanaan: jadwalMhs.pelaksanaan || 'offline',
                tanggal: jadwalMhs.tanggal || '', 
                jam_mulai: jadwalMhs.jam_mulai || '',
                jam_selesai: jadwalMhs.jam_selesai || '',
                tempat: jadwalMhs.tempat || '',
              },
              dosbing1: jadwalMhs.dosbing1 || '-',
              dosbing2: jadwalMhs.dosbing2 || '-',
              penguji: [ jadwalMhs.dosen_penguji_id ? 'Sudah Ditunjuk' : '' ]
            };
          });
          break;

        // ---------------------------------------------------------------
        // CASE 4: TAB TANDAI SELESAI (ACTION LIST - CROSSCHECK)
        // ---------------------------------------------------------------
        case 'selesai':
          const rawSelesai = await Verifikasi.selesaiUjian(tahunId);
          
          selesai = rawSelesai.map(s => {
            let jadwalDisplay = '-';
            if (s.tanggal) {
                const dateObj = new Date(s.tanggal);
                const tanggalSingkat = dateObj.toLocaleDateString('id-ID', {
                    weekday: 'long', day: 'numeric', month: 'short', year: 'numeric'
                });
                const mulai = s.jam_mulai ? s.jam_mulai.toString().slice(0, 5) : '';
                const akhir = s.jam_selesai ? s.jam_selesai.toString().slice(0, 5) : '';
                jadwalDisplay = `${tanggalSingkat}<br>${mulai} s/d ${akhir} WIB`;
            }

            return {
              id: s.mahasiswa_id || s.id,
              nama: s.nama,
              npm: s.npm,
              nama_tahun: s.nama_tahun,
              semester: s.semester,
              dosbing1: s.dosbing1 || '-', 
              dosbing2: s.dosbing2 || '-',
              jadwalUjian: jadwalDisplay, 
              status_keseluruhan: s.status_keseluruhan === true ? 'Selesai' : 'Menunggu Konfirmasi',
              tanggal_selesai: s.tanggal_selesai ? new Date(s.tanggal_selesai).toLocaleDateString('id-ID') : '-'
            };
          });
          break;
      }

      console.timeEnd('⏱️ WAKTU LOAD TAB');

      res.render('admin/verifikasi', {
        title: 'Verifikasi Pendaftaran',
        currentPage: 'verifikasi',
        role: 'admin',
        activeTab, 
        tahunId, 
        berkas, 
        jadwal, 
        surat, 
        selesai
      });

    } catch (err) {
      console.error('❌ ERROR LIST ALL:', err);
      console.timeEnd('⏱️ WAKTU LOAD TAB');
      res.status(500).send('Server Error saat memuat tab verifikasi.');
    }
  },

  // =========================================================================
  // 🔄 OPER KE KAPRODI
  // =========================================================================
  operKeKaprodi: async (req, res) => {
    try {
      const { jadwalId } = req.body;
      const editorId = req.session.user?.id || null; 

      if (!jadwalId) return res.status(400).send('jadwalId wajib dikirim');

      const mahasiswaId = await Verifikasi.updateStatusVerifikasi(jadwalId, true, editorId);
      await Verifikasi.operKeKaprodi(mahasiswaId); 
      
      res.redirect('/admin/verifikasi?tab=jadwal'); 
    } catch (err) {
      console.error('❌ Error operKeKaprodi:', err);
      res.status(500).send('Gagal mengoper mahasiswa ke Kaprodi');
    }
  },
 
  // =========================================================================
  // 🖨️ GENERATE PDF (VERCEL READY)
  // =========================================================================
generateUndanganPDF: async (req, res) => {
    try {
      const { npm } = req.params;

      // 1. Aktivasi Log
      await Verifikasi.markSuratDownloaded(npm);
      
      const data = await SuratModel.getSuratByMahasiswa(npm); 
      const logoPathFile = path.join(process.cwd(), 'public', 'images', 'unila1.png');

      if (!data) return res.status(404).send('Data tidak ditemukan.');

      // --- 🚀 SUNTIKAN FONT SAKTI DISINI ---
      // Pastikan path file .txt font lu bener ya!
      const fontPath = path.join(process.cwd(), 'public', 'fonts', 'font-base64.txt'); 
      let fontTMR = "";
      try {
          fontTMR = fs.readFileSync(fontPath, 'utf8').trim();
      } catch (e) {
          console.error("Font file gak ketemu, cek path-nya bos!");
      }
      // --------------------------------------

      const templateSettings = await AturSurat.getSettings('undangan');
      const listRincian = await Mahasiswa.getAllRincian(); 
      const pelaksanaan = data.jadwal?.pelaksanaan ? data.jadwal.pelaksanaan.toLowerCase() : 'offline';

      let catatanKaki = '';
      const note = listRincian.find(r => r.judul.toLowerCase().includes(pelaksanaan));
      catatanKaki = note ? note.keterangan : (templateSettings.catatan_kaki || '');

      const logoBuffer = fs.readFileSync(logoPathFile);
      const logoBase64 = logoBuffer.toString('base64');
      const logoSrc = `data:image/png;base64,${logoBase64}`;

      const html = await ejs.renderFile(path.join(process.cwd(), 'views/partials/surat-undangan.ejs'), {
          layout: false,
          ...data,
          fontTMR: fontTMR, // <-- Kirim variabel font ke EJS
          logoPath: logoSrc,
          namaMahasiswa: data.mahasiswa.nama,
          npm: data.mahasiswa.npm,
          tipeUjian: pelaksanaan, 
          tanggalUjian: data.jadwal?.tanggal || '',
          waktuUjian: data.jadwal?.waktu || '',
          tempatUjian: data.jadwal?.tempat || '',
          linkZoom: data.jadwal?.linkZoom || '',
          meetingID: data.jadwal?.meetingID || '',
          passcode: data.jadwal?.passcode || '',
          pembimbing1: data.dosbing[0] || '-', 
          pembimbing2: data.dosbing[1] || '-',
          penguji: data.penguji || [],
          kaprodi: data.kaprodi || { nama: '', nip_dosen: '' },
          kopSurat: templateSettings.kop_surat_text,
          kalimatPembuka: templateSettings.pembuka,
          isi: templateSettings.isi,
          kalimatPenutup: templateSettings.penutup,
          catatanKaki: catatanKaki,
          tanggalSurat: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      });

      // Konfigurasi Puppeteer
      const browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({ 
        format: 'A4', 
        printBackground: true, 
        margin: { top: '10mm', right: '10mm', bottom: '20mm', left: '10mm' } 
      });

      await browser.close();

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Surat-Undangan-${npm}.pdf"`
      });
      res.send(pdfBuffer);

    } catch (err) {
      console.error('❌ Error Generate PDF:', err);
      res.status(500).send(`Error: ${err.message}`);
    }
  },

  // =========================================================================
  // ⚙️ SETTINGS TEMPLATE
  // =========================================================================
  getTemplateSettings: async (req, res) => {
    try {
      const settings = await AturSurat.getSettings('undangan');
      res.json({ success: true, data: settings });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  saveTemplateSettings: async (req, res) => {
    try {
      const { kop_surat_text, pembuka, isi, penutup } = req.body;
      await AturSurat.updateSettings({
        jenis_surat: 'undangan',
        kop_surat_text,
        pembuka,
        isi, 
        penutup,
      });
      res.json({ success: true, message: 'Template surat berhasil diperbarui.' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // =========================================================================
  // 🛠️ API & MODAL HELPER
  // =========================================================================
  getSuratDetail: async (req, res) => {
    try {
      let { npm } = req.params;
      npm = npm.trim(); 
      const { rows } = await pool.query(`
        SELECT 
          m.id AS mahasiswa_id,
          j.id AS jadwal_id,
          j.tanggal, j.jam_mulai, j.jam_selesai, j.pelaksanaan, j.tempat,
          j.link_zoom, j.meeting_id, j.passcode,
          dp.dosen_id AS penguji_id
        FROM mahasiswa m
        LEFT JOIN jadwal j ON j.mahasiswa_id = m.id
        LEFT JOIN dosen_penguji dp ON dp.mahasiswa_id = m.id
        WHERE TRIM(m.npm) = $1
        ORDER BY j.id DESC LIMIT 1
      `, [npm]);

      if (rows.length === 0) {
          return res.status(404).json({ success: false, message: `Mahasiswa dengan NPM ${npm} tidak ditemukan.` });
      }

      const d = rows[0];
      const tanggalDB = d.tanggal ? new Date(d.tanggal).toLocaleDateString('en-CA') : '';

      res.json({ 
        success: true, 
        data: {
          mahasiswa_id: d.mahasiswa_id,
          jadwal_id: d.jadwal_id || null,
          penguji_id: d.penguji_id || null,
          jadwal: {
            tanggal_db: tanggalDB,
            jam_mulai: d.jam_mulai || '',
            jam_selesai: d.jam_selesai || '',
            pelaksanaan: d.pelaksanaan || '',
            tempat: d.tempat || '',
            linkZoom: d.link_zoom || '',
            meetingID: d.meeting_id || '',
            passcode: d.passcode || ''
          }
        }
      });
    } catch (err) {
      console.error('❌ Error getSuratDetail:', err); 
      res.status(500).json({ success: false, message: 'Server error: ' + err.message });
    }
  },

  updateSuratDetail: async (req, res) => {
    try {
      const { jadwalId } = req.params;
      const {
        mahasiswaId, tanggal, jam_mulai, jam_selesai, pelaksanaan, 
        tempat, link_zoom, meeting_id, passcode, dosen_penguji_id
      } = req.body;
      
      const editorId = req.session.user?.id || null;
      if (!jadwalId) return res.status(400).json({ success: false, message: 'Jadwal ID tidak ditemukan.' });

      const modePelaksanaan = pelaksanaan ? pelaksanaan.toLowerCase() : 'offline';
      const isOnline = modePelaksanaan === 'online';

      await Verifikasi.updateJadwal(jadwalId, {
        tanggal, 
        jam_mulai, 
        jam_selesai, 
        pelaksanaan: modePelaksanaan,
        tempat: isOnline ? 'Zoom Meeting' : tempat, 
        link_zoom: isOnline ? link_zoom : null,
        meeting_id: isOnline ? meeting_id : null,
        passcode: isOnline ? passcode : null,
        editorId 
      });
      
      if (dosen_penguji_id) {
         await Verifikasi.updateDosenPenguji(mahasiswaId, dosen_penguji_id, editorId);
      }

      await Verifikasi.resetStatusSurat(mahasiswaId, editorId);
      res.json({ success: true, message: 'Surat berhasil diperbarui & Revisi tercatat.' });

    } catch (err) {
      console.error('❌ Error updateSuratDetail:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  getDosenList: async (req, res) => {
    try {
      const dosen = await Verifikasi.getAllDosen();
      res.json({ success: true, data: dosen });
    } catch (err) {
      console.error('❌ Error getDosenList:', err);
      res.status(500).json({ success: false, message: 'Gagal memuat daftar dosen' });
    }
  },

  // =========================================================================
  // 🔥 ACTION HANDLERS (SUPABASE STORAGE FRIENDLY)
  // =========================================================================
  uploadSuratTTD: async (req, res) => {
    try {
      const npm = req.params.npm; 
      const file = req.file;
      if (!file) throw new Error("File surat tidak ditemukan.");

      // 🔥 VERCEL + SUPABASE: Upload ke Cloud Storage
      const filePath = `surat/${npm}/Undangan-TTD-${Date.now()}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from('storage_sipuapi')
        .upload(filePath, file.buffer, { contentType: 'application/pdf', upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('storage_sipuapi').getPublicUrl(filePath);
      
      // Update DB dengan URL Publik Supabase
      await SuratModel.uploadSuratFinal(npm, urlData.publicUrl, req.session.user?.id);
      
      res.redirect('/admin/verifikasi?tab=surat');
    } catch (err) {
      console.error('❌ Error uploadSuratTTD:', err);
      res.status(500).send(err.message);
    }
  },

  deleteSuratTTD: async (req, res) => {
    try {
      const { npm } = req.body;
      const oldData = await SuratModel.getSuratByMahasiswa(npm); 

      // 🔥 Hapus file di Supabase Cloud jika ada
      if (oldData && oldData.path_file && oldData.path_file.includes('supabase')) {
          const cleanPath = oldData.path_file.split('storage_sipuapi/').pop();
          await supabase.storage.from('storage_sipuapi').remove([cleanPath]);
      }

      await SuratModel.deleteSuratFile(npm);
      res.json({ success: true, message: 'File surat di cloud berhasil dihapus.' });
    } catch (err) {
      console.error('❌ Error deleteSuratTTD:', err);
      res.status(500).json({ success: false, message: 'Gagal menghapus surat.' });
    }
  },

  tandaiSelesai: async (req, res) => {
    try {
      const { mahasiswaId } = req.body;
      const editorId = req.session.user?.id || null; 

      if (!mahasiswaId) return res.status(400).json({ success: false, message: 'ID mahasiswa wajib' });
      
      await Verifikasi.tandaiSelesai(mahasiswaId, editorId);
      res.json({ success: true, message: 'Ujian mahasiswa berhasil ditandai selesai' });
    } catch (err) {
      console.error('❌ Error tandaiSelesai:', err.message);
      res.status(500).json({ success: false, message: err.message || 'Gagal menandai ujian selesai' });
    }
  }

};

module.exports = verifikasiController;