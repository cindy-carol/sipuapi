// utils/scheduler.js
const cron = require('node-cron');
const pool = require('../config/db'); // ⚠️ Cek path db config

// ========================================================
// FUNGSI UTAMA (SESUAI STRUKTUR TABEL KAMU)
// ========================================================
const generateSemester = async (dateObj = new Date()) => {
  try {
    const month = dateObj.getMonth(); // 0 = Jan, 11 = Des
    const year = dateObj.getFullYear();
    
    let namaTahun = ''; 
    let semester = '';  

    // LOGIKA PENENTUAN:
    if (month < 6) { 
      // Jan - Jun = GENAP (Tahunnya mundur 1. Cth: 2026 -> 2025/2026 Genap)
      semester = 'genap';
      namaTahun = `${year - 1}/${year}`;
    } else {
      // Jul - Des = GANJIL (Tahunnya tetap. Cth: 2025 -> 2025/2026 Ganjil)
      semester = 'ganjil';
      namaTahun = `${year}/${year + 1}`;
    }

    // 1. CEK DATA (Pakai nama_tahun & semester, bukan label)
    const cek = await pool.query(
      "SELECT id FROM tahun_ajaran WHERE nama_tahun = $1 AND semester = $2", 
      [namaTahun, semester]
    );
    
    // 2. INSERT JIKA BELUM ADA
    if (cek.rows.length === 0) {
      
      // 🔥 LANGKAH PENTING: RESET STATUS LAMA
      // Sebelum insert baru, setel semua tahun yang ada jadi FALSE (Non-Aktif)
      // Biar cuma yang baru nanti yang statusnya TRUE
      await pool.query("UPDATE tahun_ajaran SET status = false");

      // Insert Baru (Status = true)
      // Perhatikan kolomnya: nama_tahun, semester, status
      await pool.query(
        "INSERT INTO tahun_ajaran (nama_tahun, semester, status) VALUES ($1, $2, true)", 
        [namaTahun, semester]
      );
      
      console.log(`✅ AUTO-GENERATE SUKSES: ${namaTahun} ${semester} (Aktif)`);
    } else {
       // console.log(`ℹ️ Info: Tahun ${namaTahun} ${semester} sudah ada.`);
    }

  } catch (err) {
    console.error("❌ ERROR Scheduler:", err.message); 
  }
};

// ========================================================
// JADWAL CRON JOB
// ========================================================
const startScheduler = () => {
  
  // 1. CEK SAAT SERVER NYALA (Startup Check)
  console.log('⏰ System Startup: Mengecek Tahun Ajaran...');
  // ⚠️ Ganti tanggal ini ke new Date() kalau sudah selesai testing!
  generateSemester(new Date()); 

  // 2. JADWAL MASA DEPAN
  cron.schedule('1 0 1 1 *', () => { // 1 Jan
    console.log('⏰ Trigger Cron: Tahun Baru (Genap)!');
    generateSemester(new Date()); 
  });

  cron.schedule('1 0 1 7 *', () => { // 1 Juli
    console.log('⏰ Trigger Cron: Semester Baru (Ganjil)!');
    generateSemester(new Date());
  });
};

module.exports = startScheduler;