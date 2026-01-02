const express = require('express');
const router = express.Router();
const path = require('path');
const ejs = require('ejs');
const puppeteer = require('puppeteer');
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
  try {
    const { npm } = req.params;
    const data = await verifikasiController.generateUndanganPDF(npm);

    if (!data) return res.status(404).send('Data tidak ditemukan.');

    const templatePath = path.join(__dirname, '../../views/partials/surat-undangan.ejs');
    const html = await ejs.renderFile(templatePath, data, { async: true });

    // === MODIFIKASI DISINI ===
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(), // Ini buat nyari path chrome di server Vercel
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);

  } catch (err) {
    console.error('Gagal generate PDF:', err);
    res.status(500).send('Gagal membuat PDF: ' + err.message);
  }
});

module.exports = router;
