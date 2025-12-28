const express = require('express');
const router = express.Router();
const path = require('path');
const ejs = require('ejs');
const puppeteer = require('puppeteer');

// Controller
const verifikasiController = require('@controllers/admin/verifikasiController');

// -----------------------------------------------------------------------------
// 🧩 1️⃣ Route: Tampilkan daftar/preview surat undangan (di halaman web)
// -----------------------------------------------------------------------------
router.get('/surat-undangan/:npm', verifikasiController.getSuratDetail);

// -----------------------------------------------------------------------------
// 🧩 2️⃣ Route: Generate surat undangan jadi PDF pakai Puppeteer
// -----------------------------------------------------------------------------
router.get('/surat-undangan/:npm/generate', async (req, res) => {
  try {
    const { npm } = req.params;

    // === 1️⃣ Ambil data dari database ===
    const data = await verifikasiController.generateUndanganPDF(npm);
    if (!data) {
      return res.status(404).send('Data surat undangan tidak ditemukan.');
    }

    // === 2️⃣ Render surat-undangan.ejs jadi HTML ===
    const templatePath = path.join(__dirname, '../../views/partials/surat-undangan.ejs');
    const html = await ejs.renderFile(templatePath, data, { async: true });

    // === 3️⃣ Generate PDF pakai Puppeteer ===
    const browser = await puppeteer.launch({
      headless: true,
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

    // === 4️⃣ Kirim hasil PDF ke client ===
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Surat_Undangan_${npm}.pdf"`);
    res.send(pdfBuffer);

  } catch (err) {
    console.error('Gagal generate PDF:', err);
    res.status(500).send('Gagal membuat PDF surat undangan.');
  }
});

module.exports = router;
