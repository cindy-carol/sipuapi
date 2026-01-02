const express = require('express');
const router = express.Router();
const path = require('path');
const ejs = require('ejs');

// Pakai puppeteer-core dan chromium khusus Vercel
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

// Controller
const verifikasiController = require('../../controllers/admin/verifikasiController');

// -----------------------------------------------------------------------------
// 🧩 1️⃣ Route: Tampilkan daftar/preview surat undangan (di halaman web)
// -----------------------------------------------------------------------------
router.get('/surat-undangan/:npm', verifikasiController.getSuratDetail);

// -----------------------------------------------------------------------------
// 🧩 2️⃣ Route: Generate surat undangan jadi PDF pakai Puppeteer
// -----------------------------------------------------------------------------
router.get('/surat-undangan/:npm/generate', async (req, res) => {
  let browser = null;
  try {
    const { npm } = req.params;

    // 1. Ambil data dari database
    const data = await verifikasiController.generateUndanganPDF(npm);
    if (!data) return res.status(404).send('Data tidak ditemukan.');

    // 2. Render EJS ke HTML string
    // Pastikan path ke folder views sudah benar dari lokasi file ini
    const templatePath = path.join(__dirname, '../../views/partials/surat-undangan.ejs');
    const html = await ejs.renderFile(templatePath, data, { async: true });

    // 3. Konfigurasi Chromium untuk Serverless
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(), // Otomatis cari path chromium di Vercel
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    
    // Set konten HTML ke page puppeteer
    await page.setContent(html, { 
      waitUntil: 'networkidle0', // Tunggu sampai semua aset (gambar/css) ke-load
      timeout: 30000 // Limit 30 detik
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '20mm', left: '10mm' }
    });

    // 4. Kirim hasil PDF ke client
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Surat_Undangan_${npm}.pdf"`);
    res.send(pdfBuffer);

  } catch (err) {
    console.error('Gagal generate PDF:', err);
    res.status(500).send('Gagal membuat PDF: ' + err.message);
  } finally {
    // 5. Wajib ditutup biar gak boros memori (biar gak kena limit Vercel)
    if (browser !== null) {
      await browser.close();
    }
  }
});

module.exports = router;