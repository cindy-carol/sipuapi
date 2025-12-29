// utils/scheduler.js
const cron = require('node-cron');
const pool = require('../config/db'); 

// ========================================================
// 1. FUNGSI INTI (GENERATOR)
// ========================================================
const generateSemester = async (dateObj) => {
  try {
    const month = dateObj.getMonth(); 
    const year = dateObj.getFullYear();
    
    let namaTahun = ''; 
    let semester = '';  

    // Tentukan Semester
    if (month < 6) { 
      semester = 'genap';
      namaTahun = `${year - 1}/${year}`;
    } else {
      semester = 'ganjil';
      namaTahun = `${year}/${year + 1}`;
    }

    // Cek DB
    const cek = await pool.query(
      "SELECT id FROM tahun_ajaran WHERE nama_tahun = $1 AND semester = $2", 
      [namaTahun, semester]
    );
    
    if (cek.rows.length === 0) {
      // Matikan status tahun lain dulu
      await pool.query("UPDATE tahun_ajaran SET status = false");

      // Insert tahun ini sebagai TRUE (Aktif)
      // Nanti pas looping, yang 'True' bakal pindah-pindah sampai tahun terakhir.
      await pool.query(
        "INSERT INTO tahun_ajaran (nama_tahun, semester, status) VALUES ($1, $2, true)", 
        [namaTahun, semester]
      );
      console.log(`✅ GENERATED: ${namaTahun} ${semester}`);
    }
  } catch (err) {
    console.error("❌ ERROR:", err.message); 
  }
};

// ========================================================
// 2. 🔥 FUNGSI TIME TRAVEL (SEEDER)
// ========================================================
const runSeeder = async () => {
  console.log("🚀 MEMULAI PROSES GENERATE HISTORY (2023 - SEKARANG)...");

  // A. KITA MULAI DARI JULI 2023 (Biar dapet 2023/2024 Ganjil)
  let currentDate = new Date('2023-07-01'); 
  const today = new Date();

  // B. LOOPING SAMPAI HARI INI
  while (currentDate <= today) {
    // Generate semester buat tanggal 'currentDate'
    await generateSemester(currentDate);

    // Maju 6 Bulan ke depan
    currentDate.setMonth(currentDate.getMonth() + 6);
  }

  console.log("🏁 SELESAI! Database sudah terisi rapi.");
};

// ========================================================
// 3. START SCHEDULER
// ========================================================
const startScheduler = () => {
  
  // 🔥 JALANKAN SEEDER SEKALI AJA PAS SERVER NYALA
  runSeeder();

  // Jadwal Cron Job (Tetap dipasang buat masa depan)
  cron.schedule('1 0 1 1 *', () => { generateSemester(new Date()); });
  cron.schedule('1 0 1 7 *', () => { generateSemester(new Date()); });
};

module.exports = startScheduler;