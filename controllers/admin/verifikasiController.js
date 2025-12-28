// controllers/admin/verifikasiController.js

const Verifikasi = require('@models/verifikasiModel.js');
const puppeteer = require('puppeteer');
const SuratModel = require('@models/suratUndanganModel.js'); 
const AturSurat = require('@models/aturSuratModel.js'); 
const { Dosen } = require('@models/dosenModel.js');
const path = require('path');
const fs = require('fs');
const pool = require('@config/db'); 
const { Mahasiswa } = require('@models/mahasiswaModel.js'); // Untuk catatan kaki

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
            // Logic Format Tanggal & Jam (Biar Admin enak bacanya)
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
              
              // 🔥 Data Lengkap buat Crosscheck
              dosbing1: s.dosbing1 || '-', 
              dosbing2: s.dosbing2 || '-',
              jadwalUjian: jadwalDisplay, 

              // Status boolean di DB, kita ubah jadi Text buat tampilan
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
  // 🖨️ GENERATE PDF 
  // =========================================================================
  generateUndanganPDF: async (req, res) => {
    try {
      const { npm } = req.params;

      await Verifikasi.markSuratDownloaded(npm);
      
      const data = await SuratModel.getSuratByMahasiswa(npm); 
      const logoPathFile = path.join(process.cwd(), 'public', 'images', 'unila1.png');

      if (!data) return res.status(404).send('Data surat undangan tidak ditemukan.');

      const templateSettings = await AturSurat.getSettings('undangan');

      const listRincian = await Mahasiswa.getAllRincian(); 
      const pelaksanaan = data.jadwal?.pelaksanaan ? data.jadwal.pelaksanaan.toLowerCase() : 'offline';

      let catatanKaki = '';
      if (pelaksanaan === 'online') {
          const note = listRincian.find(r => r.judul.toLowerCase().includes('online'));
          catatanKaki = note ? note.keterangan : '';
      } else {
          const note = listRincian.find(r => r.judul.toLowerCase().includes('offline'));
          catatanKaki = note ? note.keterangan : '';
      }

      if (!catatanKaki) {
          catatanKaki = templateSettings.catatan_kaki || '';
      }

      const now = new Date();
      const tanggalHariIni = now.toLocaleDateString('id-ID', {
          day: 'numeric', month: 'long', year: 'numeric'
      });

      const logoBuffer = fs.readFileSync(logoPathFile);
      const logoBase64 = logoBuffer.toString('base64');
      const logoSrc = `data:image/png;base64,${logoBase64}`;

      const html = await new Promise((resolve, reject) => {
        res.render('partials/surat-undangan', { 
          layout: false,
          ...data,
          title: 'Surat Undangan',
          role: 'admin',
          tanggalSurat: tanggalHariIni,
          namaMahasiswa: data.mahasiswa.nama,
          npm: data.mahasiswa.npm,
          tipeUjian: pelaksanaan, 
          tanggalUjian: data.jadwal?.tanggal || '',
          waktuUjian: data.jadwal?.waktu || '',
          tempatUjian: data.jadwal?.tempat || '',
          linkZoom: data.jadwal?.linkZoom || '',
          meetingID: data.jadwal?.meetingID || '',
          passcode: data.jadwal?.passcode || '',
          pembimbing1: data.dosbing[0],
          pembimbing2: data.dosbing[1],
          penguji: data.penguji || [],
          kaprodi: data.kaprodi || { nama: '', nip_dosen: '' },
          logoPath: logoSrc,
          kopSurat: templateSettings.kop_surat_text,
          kalimatPembuka: templateSettings.pembuka,
          isi: templateSettings.isi,
          kalimatPenutup: templateSettings.penutup,
          catatanKaki: catatanKaki 
        }, (err, rendered) => {
          if (err) reject(err);
          else resolve(rendered);
        });
      });

      const browser = await puppeteer.launch({ 
        headless: "new", 
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
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
      console.error('Gagal generate PDF:', err);
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
      // Tangkap 'isi' dari body
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

      // 🔥 FIX LOGIC ONLINE/OFFLINE
      // Pastikan string lowercasenya konsisten
      const modePelaksanaan = pelaksanaan ? pelaksanaan.toLowerCase() : 'offline';
      const isOnline = modePelaksanaan === 'online';

      // Jika Offline, paksa data zoom jadi NULL biar database bersih
      // Jika Online, paksa TEMPAT jadi string khusus (misal 'Zoom Meeting') atau biarkan inputan
      
      await Verifikasi.updateJadwal(jadwalId, {
        tanggal, 
        jam_mulai, 
        jam_selesai, 
        pelaksanaan: modePelaksanaan, // Simpan lowercase biar konsisten
        
        // Logic Tempat:
        tempat: isOnline ? 'Zoom Meeting' : tempat, 
        
        // Logic Zoom Data:
        link_zoom: isOnline ? link_zoom : null,
        meeting_id: isOnline ? meeting_id : null,
        passcode: isOnline ? passcode : null,
        
        editorId 
      });
      
      // Update Dosen Penguji jika ada perubahan
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
  // 🔥 ACTION HANDLERS (UPLOAD, DELETE, SELESAI)
  // =========================================================================
  
// verifikasiController.js
// verifikasiController.js
// verifikasiController.js
// controllers/admin/verifikasiController.js
uploadSuratTTD: async (req, res) => {
  try {
    // Ambil dari params
    const npm = req.params.npm; 
    if (!npm) throw new Error("NPM tidak ditemukan.");

    const relativePath = `/upload/mahasiswa/admin/surat_undangan_ttd/${req.file.filename}`;
    
    await SuratModel.uploadSuratFinal(npm, relativePath, req.session.user?.id);
    
    res.redirect('/admin/verifikasi?tab=surat');
  } catch (err) {
    res.status(500).send(err.message);
  }
},

  // 🔥 HANDLER HAPUS SURAT (YG TADI 404)
  deleteSuratTTD: async (req, res) => {
    try {
      const { npm } = req.body;
      const oldData = await SuratModel.deleteSuratFile(npm);

      if (oldData && oldData.path_file) {
         const fullPath = path.join(__dirname, '../../public', oldData.path_file);
         if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      }
      res.json({ success: true, message: 'File surat berhasil dihapus.' });

    } catch (err) {
      console.error('❌ Error deleteSuratTTD:', err);
      res.status(500).json({ success: false, message: 'Gagal menghapus surat.' });
    }
  },

  // 🔥 HANDLER TANDAI SELESAI
  tandaiSelesai: async (req, res) => {
    try {
      const { mahasiswaId } = req.body;
      const editorId = req.session.user?.id || null; 

      if (!mahasiswaId) return res.status(400).json({ success: false, message: 'ID mahasiswa wajib' });
      
      // Update Boolean status jadi TRUE
      await Verifikasi.tandaiSelesai(mahasiswaId, editorId);
      
      res.json({ success: true, message: 'Ujian mahasiswa berhasil ditandai selesai' });
    } catch (err) {
      console.error('❌ Error tandaiSelesai:', err.message);
      res.status(500).json({ success: false, message: err.message || 'Gagal menandai ujian selesai' });
    }
  }

};

module.exports = verifikasiController;