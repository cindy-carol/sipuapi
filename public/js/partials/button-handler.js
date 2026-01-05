// ===================================================
// =============== GLOBAL EVENT HANDLER ===============
// ===================================================
document.addEventListener('DOMContentLoaded', () => {

  // ===================================================
  // =============== 1️⃣ BACK / REDIRECT BUTTON ==========
  // ===================================================
  document.querySelectorAll('.btn-back, .btn-redirect').forEach(btn => {
    const target = btn.getAttribute('data-target');
    if (target) btn.addEventListener('click', () => window.location.href = target);
  });


  // ===================================================
  // =============== 2️⃣ STATUS COLOR SWITCHER ==========
  // ===================================================
document.querySelectorAll('.status-select').forEach(select => {

  // Event saat admin mengubah status
  select.addEventListener('change', async function() {
    const newVal = this.value;
    const id = this.dataset.id; // Pastikan dataset ID diambil

    // 1. Ganti Warna Langsung (Feedback Visual Sementara)
    this.classList.remove('btn-info', 'btn-success', 'btn-danger');
    if (newVal === 'true') this.classList.add('btn-success');
    else if (newVal === 'false') this.classList.add('btn-danger');
    else this.classList.add('btn-info');

    // 2. Kirim ke Server
    if (id) {
      try {
        // (Opsional) Kunci dropdown biar gak diklik-klik pas loading
        this.disabled = true;

        const res = await fetch(`/admin/verifikasi/update-status/${id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            status: newVal
          }),
        });

        const result = await res.json();
        
        if (result.success) {
          // 🔥 TAMBAHAN UTAMA DI SINI 🔥
          // Reload halaman agar logika EJS jalan lagi (tombol Edit Catatan muncul/hilang)
          window.location.reload();
        } else {
          alert('Gagal update database!');
          this.disabled = false; // Buka kunci kalau gagal
        }
      } catch (err) {
        console.error('❌ Error:', err);
        alert('Terjadi kesalahan koneksi.');
        this.disabled = false;
      }
    }
  });
});

  // ===================================================
  // =============== 3️⃣ UNIVERSAL INLINE EDIT ==========
  // ===================================================
// ===================================================
// =============== GLOBAL EVENT HANDLER ===============
// ===================================================


    // ===================================================
    // 🔥 LOGIC EDIT KARTU (INLINE EDIT) 🔥
    // ===================================================

    // A. KLIK TOMBOL EDIT (ORANYE)
    document.body.addEventListener('click', function(e) {
        const btn = e.target.closest('.btn-edit-rincian');
        if (!btn) return; // Kalau bukan tombol edit, abaikan

        const container = btn.closest('.editable-container');
        if (!container) return;

        // Switch Tampilan: Teks -> Input
        container.querySelectorAll('.content-view').forEach(el => el.classList.add('d-none'));
        container.querySelectorAll('.editor-view').forEach(el => el.classList.remove('d-none'));

        // Switch Tombol: Edit -> Simpan & Batal
        btn.classList.add('d-none');
        container.querySelector('.btn-save-rincian').classList.remove('d-none');
        container.querySelector('.btn-cancel-rincian').classList.remove('d-none');
    });

    // B. KLIK TOMBOL BATAL (ABU)
    document.body.addEventListener('click', function(e) {
        const btn = e.target.closest('.btn-cancel-rincian');
        if (!btn) return;

        const container = btn.closest('.editable-container');
        
        // Switch Tampilan: Input -> Teks
        container.querySelectorAll('.content-view').forEach(el => el.classList.remove('d-none'));
        container.querySelectorAll('.editor-view').forEach(el => el.classList.add('d-none'));

        // Switch Tombol: Simpan & Batal -> Edit
        container.querySelector('.btn-edit-rincian').classList.remove('d-none');
        btn.classList.add('d-none');
        container.querySelector('.btn-save-rincian').classList.add('d-none');
    });

    // C. KLIK TOMBOL SIMPAN (HIJAU) - PUSH KE DB
    document.body.addEventListener('click', async function(e) {
        const btn = e.target.closest('.btn-save-rincian');
        if (!btn) return;

        const container = btn.closest('.editable-container');
        const id = container.dataset.id;

        const titleInput = container.querySelector('.rincian-title-input').value;
        const contentInput = container.querySelector('.rincian-content-input').value;

        // Efek Loading
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        btn.classList.add('disabled');

        try {
            const response = await fetch('/admin/dashboard/update-rincian', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: id,
                    title: titleInput,
                    content: contentInput
                })
            });

            const result = await response.json();

            if (result.success) {
                // Update Tampilan Layar
                container.querySelector('h5.content-view').textContent = titleInput;
                container.querySelector('p.content-view').textContent = contentInput;

                // Otomatis klik batal (biar balik ke mode baca)
                container.querySelector('.btn-cancel-rincian').click();
            } else {
                alert('Gagal: ' + result.message);
            }
        } catch (error) {
            console.error(error);
            alert('Gagal koneksi ke server');
        } finally {
            btn.innerHTML = originalHtml;
            btn.classList.remove('disabled');
        }
    });


    // ===================================================
// =============== 4️⃣ INLINE EDIT DATA DOSEN (SPESIFIK) ===
// ===================================================

const startEditDosenMode = (row) => {
    // 1. Tampilkan Input/Select (Edit Mode) & Sembunyikan Teks
    row.querySelectorAll('.editable-cell').forEach(cell => {
        cell.querySelector('.view-content')?.classList.add('d-none');
        cell.querySelector('.edit-input')?.classList.remove('d-none');
    });

    // 2. Tampilkan Tombol Simpan & Batal, Sembunyikan Tombol Edit
    row.querySelector('.btn-edit-dosen')?.classList.add('d-none');
    row.querySelector('.btn-save-dosen')?.classList.remove('d-none');
    row.querySelector('.btn-cancel-dosen')?.classList.remove('d-none');
};

const cancelEditDosenMode = (row) => {
    // 1. Tampilkan Teks (View Mode) & Sembunyikan Input/Select
    row.querySelectorAll('.editable-cell').forEach(cell => {
        cell.querySelector('.view-content')?.classList.remove('d-none');
        cell.querySelector('.edit-input')?.classList.add('d-none');
        // Saat batal, nilai input tidak di-reset, tapi tombol edit kembali muncul
    });

    // 2. Tampilkan Tombol Edit, Sembunyikan Tombol Simpan & Batal
    row.querySelector('.btn-edit-dosen')?.classList.remove('d-none');
    row.querySelector('.btn-save-dosen')?.classList.add('d-none');
    row.querySelector('.btn-cancel-dosen')?.classList.add('d-none');
};

// A. KLIK TOMBOL EDIT (btn-edit-dosen)
document.body.addEventListener('click', function(e) {
    const btn = e.target.closest('.btn-edit-dosen');
    if (!btn) return;

    const row = btn.closest('.dosen-row');
    if (!row) return;

    startEditDosenMode(row);
});

// B. KLIK TOMBOL BATAL (btn-cancel-dosen)
document.body.addEventListener('click', function(e) {
    const btn = e.target.closest('.btn-cancel-dosen');
    if (!btn) return;

    const row = btn.closest('.dosen-row');
    cancelEditDosenMode(row);
});

// C. KLIK TOMBOL SIMPAN (btn-save-dosen) - PUSH KE DB
document.body.addEventListener('click', async function(e) {
    const btn = e.target.closest('.btn-save-dosen');
    if (!btn) return;

    const row = btn.closest('.dosen-row');
    const id = row.dataset.id;
    const dataToUpdate = {};
    let isChanged = false;

    // 1. Ambil Data Baru dan Cek Perubahan
    row.querySelectorAll('.editable-cell').forEach(cell => {
        const field = cell.dataset.field;
        const input = cell.querySelector('.edit-input');
        const viewContent = cell.querySelector('.view-content');
        
        let newValue = input.tagName === 'SELECT' ? input.value : input.value.trim();
        let viewValue = viewContent.textContent.trim();

        // Normalisasi untuk perbandingan
        if (field === 'status_aktif') {
            viewValue = viewValue === 'Aktif' ? 'true' : 'false';
        }
        
        // Simpan semua data, karena backend butuh semua field untuk validasi
        dataToUpdate[field] = newValue;

        if (String(newValue) !== String(viewValue)) {
             isChanged = true;
        }
    });
    
    // Jika tidak ada perubahan, batalkan mode edit dan keluar
    if (!isChanged) {
        cancelEditDosenMode(row);
        alert('Tidak ada perubahan data yang disimpan.');
        return;
    }

    if (!id) {
        alert('ID Dosen tidak ditemukan.');
        return;
    }

    // Efek Loading pada tombol
    const originalHtml = btn.innerHTML;
    const width = btn.offsetWidth; 
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
    btn.style.width = width + 'px'; 
    btn.classList.add('disabled');

    try {
        // Panggil endpoint UPDATE: /admin/dosen/:id (PUT)
        // Endpoint ini akan ditangani oleh updateDosen di daftarDosenController.js
        const response = await fetch(`/admin/dosen/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToUpdate)
        });

        const result = await response.json();

        if (response.ok && result.success) {
            // 2. Update Tampilan Layar (View Content)
            row.querySelectorAll('.editable-cell').forEach(cell => {
                const field = cell.dataset.field;
                const input = cell.querySelector('.edit-input');
                const viewContent = cell.querySelector('.view-content');
                
                let newValue = input.tagName === 'SELECT' ? input.value : input.value.trim();

                // Format teks di tampilan view
                if (field === 'status_aktif') {
                    viewContent.textContent = newValue === 'true' ? 'Aktif' : 'Non Aktif';
                } else {
                    viewContent.textContent = newValue;
                }
            });

            // 3. Kembali ke mode lihat
            cancelEditDosenMode(row); 

            alert('Sukses: Data Dosen berhasil diperbarui.');
            window.location.reload();

        } else {
            // Tampilkan pesan error dari controller (misal: NIP duplikat)
            alert('Gagal: ' + (result.message || 'Gagal memperbarui data.'));
        }
    } catch (error) {
        console.error('❌ Error Update Inline Dosen:', error);
        alert('Gagal koneksi ke server.');
    } finally {
        btn.innerHTML = originalHtml;
        btn.classList.remove('disabled');
        btn.style.width = ''; 
    }
});


// ===================================================
// =============== 9️⃣ CREATE DOSEN VIA MODAL =========
// ===================================================
const formTambahDosen = document.getElementById('formTambahDosen');
if (formTambahDosen) {
    formTambahDosen.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const btn = this.querySelector('.btn-submit-tambah-dosen');
        const originalHtml = btn.innerHTML;
        
        // 1. Efek Loading
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Loading...';
        btn.disabled = true;

        // 2. Ambil Data
        const formData = new FormData(this);
        // Ubah FormData menjadi objek JSON
        const data = Object.fromEntries(formData.entries()); 

        try {
            // 3. Kirim POST request ke /admin/dosen
            const response = await fetch('/admin/dosen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                alert(result.message);
                
                // 4. Sukses: Tutup modal dan refresh halaman
                window.location.reload(); 
            } else {
                // 5. Gagal (Termasuk NIP/Kode Dosen duplikat)
                alert('Gagal: ' + (result.message || 'Terjadi kesalahan pada server.'));
                
                // Jika gagal, pastikan modal tetap terbuka (tidak reload)
                const modal = bootstrap.Modal.getInstance(document.getElementById('modalTambahDosen'));
                if (modal) modal.show();
            }
        } catch (error) {
            console.error('❌ Error createDosen:', error);
            alert('Gagal koneksi ke server.');
        } finally {
            // Kembalikan tombol ke keadaan semula
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    });
}

// ===================================================
// =============== 5️⃣ INLINE EDIT DATA MAHASISWA ===
// ===================================================

const startEditMhsMode = (row) => {
    // 1. Tampilkan Input/Select (Edit Mode) & Sembunyikan Teks
    row.querySelectorAll('.editable-cell').forEach(cell => {
        cell.querySelector('.view-content')?.classList.add('d-none');
        cell.querySelector('.edit-input')?.classList.remove('d-none');
    });

    // 2. Tampilkan Tombol Simpan & Batal, Sembunyikan Tombol Edit
    row.querySelector('.btn-edit-mhs')?.classList.add('d-none');
    row.querySelector('.btn-save-mhs')?.classList.remove('d-none');
    row.querySelector('.btn-cancel-mhs')?.classList.remove('d-none');
};

const cancelEditMhsMode = (row) => {
    // 1. Tampilkan Teks (View Mode) & Sembunyikan Input/Select
    row.querySelectorAll('.editable-cell').forEach(cell => {
        cell.querySelector('.view-content')?.classList.remove('d-none');
        cell.querySelector('.edit-input')?.classList.add('d-none');
    });

    // 2. Tampilkan Tombol Edit, Sembunyikan Tombol Simpan & Batal
    row.querySelector('.btn-edit-mhs')?.classList.remove('d-none');
    row.querySelector('.btn-save-mhs')?.classList.add('d-none');
    row.querySelector('.btn-cancel-mhs')?.classList.add('d-none');
};

// A. KLIK TOMBOL EDIT (btn-edit-mhs)
// A. KLIK TOMBOL EDIT (btn-edit-mhs) - LOGIC YANG HILANG/TERTUKAR
document.body.addEventListener('click', function(e) {
    // 1. Cek apakah tombol yang diklik adalah tombol EDIT
    const btn = e.target.closest('.btn-edit-mhs');
    
    // Hapus console.log yang membingungkan dari sini
    
    if (!btn) return; // Jika bukan tombol edit, keluar

    const row = btn.closest('.mahasiswa-row');
    if (!row) {
        console.error('❌ Error: Could not find parent .mahasiswa-row');
        return;
    }

    startEditMhsMode(row); // Panggil fungsi untuk masuk mode edit
});
// ----------------------------------------------------
// B. KLIK TOMBOL BATAL (btn-cancel-mhs) - Sudah ada
// ----------------------------------------------------
// C. KLIK TOMBOL SIMPAN (btn-save-mhs) - Sudah ada (logic AJAX)

// B. KLIK TOMBOL BATAL (btn-cancel-mhs)
document.body.addEventListener('click', function(e) {
    const btn = e.target.closest('.btn-cancel-mhs');
    if (!btn) return;

    const row = btn.closest('.mahasiswa-row');
    cancelEditMhsMode(row);
});

// C. KLIK TOMBOL SIMPAN (btn-save-mhs) - PUSH KE DB
// C. KLIK TOMBOL SIMPAN (btn-save-mhs) - PUSH KE DB
document.body.addEventListener('click', async function(e) {
    const btn = e.target.closest('.btn-save-mhs');
    if (!btn) return;

    const row = btn.closest('.mahasiswa-row');
    const npmLama = row.dataset.id; 
    const dataToUpdate = {};
    let isChanged = false;

    // 1. Ambil Data Baru dan Cek Perubahan (CLEAN)
    row.querySelectorAll('.editable-cell').forEach(cell => {
        const field = cell.dataset.field;
        const input = cell.querySelector('.edit-input');
        const viewContent = cell.querySelector('.view-content');
        
        // 🚨 PASTIKAN INI HANYA UNTUK MENGAMBIL NILAI BARU
        let newValue = input.tagName === 'SELECT' ? input.value : input.value.trim();
        let viewValue = viewContent.textContent.trim();
        
        dataToUpdate[field] = newValue;

        // Cek perubahan
        if (String(newValue) !== String(viewValue)) {
             isChanged = true;
        }
        // !!! L O G I C 
        // D I S P L A Y 
        // D I H A P U S 
        // D A R I 
        // S I N I 
        // !!!
    });
    
    // Jika tidak ada perubahan
    if (!isChanged) {
        cancelEditMhsMode(row);
        alert('Tidak ada perubahan data yang disimpan.');
        return;
    }

    if (!npmLama) {
        alert('NPM Mahasiswa tidak ditemukan.');
        return;
    }

    // Efek Loading pada tombol
    const originalHtml = btn.innerHTML;
    const width = btn.offsetWidth; 
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
    btn.style.width = width + 'px'; 
    btn.classList.add('disabled');

    try {
        const response = await fetch(`/admin/mahasiswa/${npmLama}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToUpdate)
        });

        const result = await response.json();

        if (response.ok && result.success) {
            // 2. Update Tampilan Layar (View Content)
            row.querySelectorAll('.editable-cell').forEach(cell => {
                const input = cell.querySelector('.edit-input');
                const viewContent = cell.querySelector('.view-content');
                
                let newValue = input.tagName === 'SELECT' ? input.value : input.value.trim();

                // Update input/select value untuk menjaga state
                input.value = newValue; 
                
                // *** KODE PERBAIKAN DISPLAY DI SINI (SETELAH AJAX SUKSES) ***
                if (input.tagName === 'SELECT') {
                    // Ambil properti .text dan hilangkan whitespace non-standar
                    let selectedText = input.options[input.selectedIndex].text;
                    selectedText = selectedText.replace(/\s+/g, ' ').trim(); 
                    
                    viewContent.textContent = selectedText;
                } else {
                    viewContent.textContent = newValue;
                }
            });

            // 3. Kembali ke mode lihat
            cancelEditMhsMode(row); 

            alert('Sukses: Data Mahasiswa berhasil diperbarui.');
            window.location.reload();

        } else {
            alert('Gagal: ' + (result.message || 'Gagal memperbarui data.'));
        }
    } catch (error) {
        console.error('❌ Error Update Inline Mahasiswa:', error);
        alert('Gagal koneksi ke server.');
    } finally {
        btn.innerHTML = originalHtml;
        btn.classList.remove('disabled');
        btn.style.width = ''; 
    }
});

const formTambahMhs = document.getElementById('formTambahMhs');
if (formTambahMhs) {
    formTambahMhs.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const btn = this.querySelector('.btn-submit-tambah-mahasiswa'); // Selector Mahasiswa
        const originalHtml = btn.innerHTML;
        
        // 1. Efek Loading
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Loading...';
        btn.disabled = true;

        // 2. Ambil Data
        const formData = new FormData(this);
        // Ubah FormData menjadi objek JSON
        const data = Object.fromEntries(formData.entries()); 

        try {
            // 3. Kirim POST request ke /admin/mahasiswa (Endpoint Mahasiswa)
            const response = await fetch('/admin/mahasiswa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                alert(result.message);
                
                // 4. Sukses: Tutup modal dan refresh halaman
                window.location.reload(); 
            } else {
                // 5. Gagal (Termasuk NPM duplikat)
                alert('Gagal: ' + (result.message || 'Terjadi kesalahan pada server.'));
                
                // Jika gagal, pastikan modal tetap terbuka
                const modal = bootstrap.Modal.getInstance(document.getElementById('modalTambahMahasiswa')); // ID Modal Mahasiswa
                if (modal) modal.show();
            }
        } catch (error) {
            console.error('❌ Error createMahasiswa:', error);
            alert('Gagal koneksi ke server.');
        } finally {
            // Kembalikan tombol ke keadaan semula
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    });
}

// button-handler.js

// Tambahkan fungsi ini untuk dijalankan saat modal dibuka
document.getElementById('modalTambahMahasiswa')?.addEventListener('show.bs.modal', function () {
    const selectTahun = document.getElementById('tahun_ajaran_modal');
    if (selectTahun) {
        // Cari opsi pertama yang memiliki value (bukan placeholder "Pilih Tahun Ajaran")
        const opsiTerbaru = Array.from(selectTahun.options).find(opt => opt.value !== "");
        
        if (opsiTerbaru) {
            selectTahun.value = opsiTerbaru.value;
        }
    }
});

// ===================================================
// =============== 7️⃣ INLINE EDIT DOSBING =============
// ===================================================

const startEditDosbingMode = (row) => {
    // 1. Tampilkan Input/Select (Edit Mode) & Sembunyikan Teks
    row.querySelectorAll('.editable-cell').forEach(cell => {
        cell.querySelector('.view-content')?.classList.add('d-none');
        cell.querySelector('.edit-input')?.classList.remove('d-none');
    });

    // 2. Tampilkan Tombol Simpan & Batal, Sembunyikan Tombol Edit
    row.querySelector('.btn-edit-dosbing')?.classList.add('d-none');
    row.querySelector('.btn-save-dosbing')?.classList.remove('d-none');
    row.querySelector('.btn-cancel-dosbing')?.classList.remove('d-none');
};

const cancelEditDosbingMode = (row) => {
    // 1. Tampilkan Teks (View Mode) & Sembunyikan Input/Select
    row.querySelectorAll('.editable-cell').forEach(cell => {
        cell.querySelector('.view-content')?.classList.remove('d-none');
        cell.querySelector('.edit-input')?.classList.add('d-none');
    });

    // 2. Tampilkan Tombol Edit, Sembunyikan Tombol Simpan & Batal
    row.querySelector('.btn-edit-dosbing')?.classList.remove('d-none');
    row.querySelector('.btn-save-dosbing')?.classList.add('d-none');
    row.querySelector('.btn-cancel-dosbing')?.classList.add('d-none');
};

// A. KLIK TOMBOL EDIT (.btn-edit-dosbing)
document.body.addEventListener('click', function(e) {
    const btn = e.target.closest('.btn-edit-dosbing');
    if (!btn) return;

    const row = btn.closest('.dosbing-row'); 
    if (!row) return;

    startEditDosbingMode(row);
});

// B. KLIK TOMBOL BATAL (.btn-cancel-dosbing)
document.body.addEventListener('click', function(e) {
    const btn = e.target.closest('.btn-cancel-dosbing');
    if (!btn) return;

    const row = btn.closest('.dosbing-row');
    cancelEditDosbingMode(row);
});

// C. KLIK TOMBOL SIMPAN (.btn-save-dosbing) - PUSH KE DB
// C. KLIK TOMBOL SIMPAN (.btn-save-dosbing) - PUSH KE DB
document.body.addEventListener('click', async function(e) {
    const btn = e.target.closest('.btn-save-dosbing');
    if (!btn) return;

    const row = btn.closest('.dosbing-row');
    const npm = row.dataset.id;
    const dataToUpdate = {};

    // 1. Ambil Data dari Input
    row.querySelectorAll('.editable-cell').forEach(cell => {
        const field = cell.dataset.field; 
        const input = cell.querySelector('.edit-input');
        let newValue = input.value; 
        dataToUpdate[field] = newValue === '' ? null : newValue;
    });

    // 🔥 VALIDASI: DOSBING 1 TIDAK BOLEH SAMA DENGAN DOSBING 2
    // Asumsi: nama field di dataset adalah 'dosbing1_id' dan 'dosbing2_id'
    const d1 = dataToUpdate['dosbing1_id'];
    const d2 = dataToUpdate['dosbing2_id'];

    if (d1 !== null && d2 !== null && d1 === d2) {
        alert('❌ Error: Dosen Pembimbing 1 dan 2 tidak boleh orang yang sama!');
        return; // Berhenti di sini, jangan lanjut ke fetch
    }

    if (!npm) {
        alert('NPM Mahasiswa tidak ditemukan.');
        return;
    }
    
    // ... Sisa kode Efek Loading & AJAX Call ...
    const originalHtml = btn.innerHTML;
    const width = btn.offsetWidth; 
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
    btn.style.width = width + 'px'; 
    btn.classList.add('disabled');

    try {
        const response = await fetch(`/admin/bagi-dosbing/update-dosbing/${npm}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToUpdate)
        });

        const result = await response.json();

        if (response.ok && result.success) {
            // ... Logic Update Tampilan ...
            alert('Sukses: Dosen Pembimbing berhasil diperbarui.');
            window.location.reload();
        } else {
            alert('Gagal: ' + (result.message || 'Gagal memperbarui data.'));
        }
    } catch (error) {
        console.error('❌ Error Update Dosbing Inline:', error);
        alert('Gagal koneksi ke server.');
    } finally {
        btn.innerHTML = originalHtml;
        btn.classList.remove('disabled');
        btn.style.width = ''; 
    }
});

// ... (Kode bagian atas tetap sama)

// ===================================================
// =============== X. HELPER EDIT SURAT ===============
// ===================================================
// ===================================================
// =============== X. HELPER EDIT SURAT (WAJIB ADA) ==
// ===================================================

// 1. Helper: Mengatur Tampilan Online/Offline & Auto-Fill Tempat
// ===================================================
// 1. Helper: Mengatur Tampilan Online/Offline
// ===================================================
window.toggleTempatEdit = function(selectEl) {
  const isOnline = selectEl.value === 'online';
  
  // 1. Ambil elemen container & input
  const offlineBox = document.getElementById('tempat-offline-container');
  const onlineBox = document.getElementById('tempat-online-container');
  const tempatInput = document.getElementById('edit-tempat'); // Input text tempat
  
  // 2. Atur Visibilitas (Show/Hide)
  if(offlineBox) offlineBox.classList.toggle('d-none', isOnline); // Sembunyikan offline box kalo online
  if(onlineBox) onlineBox.classList.toggle('d-none', !isOnline);  // Sembunyikan online box kalo offline
  
  // 3. LOGIC AUTO-FILL (Ini yang kamu minta)
  if (tempatInput) {
      if (isOnline) {
          // Jika ONLINE: Isi otomatis "Zoom Meeting"
          // Input ini akan tersembunyi (d-none), tapi nilainya tetap terkirim ke database
          tempatInput.value = 'Zoom Meeting';
      } else {
          // Jika OFFLINE: Isi otomatis "Ruang Sidang PSPPI"
          tempatInput.value = 'Ruang Sidang PSPPI';
      }
  }
};

// ===================================================
// 2. Helper: Fetch Daftar Dosen & Pilih Sesuai ID
// ===================================================
// File: button-handler.js

// ===================================================
// HELPER: Fetch Dosen & Populate Dropdown
// ===================================================
const fetchDosenAndPopulate = async (selectedId) => {
    const select = document.getElementById('edit-dosen-penguji');
    if(!select) return;
    
    // Cek apakah data sudah dimuat sebelumnya? (agar tidak fetch berulang kali)
    // Kecuali kamu mau fresh load setiap saat, hapus kondisi if ini.
    if (select.options.length <= 1) { 
        select.innerHTML = '<option value="">Memuat data...</option>';
        try {
            // Panggil API yang baru kita buat
            // Pastikan URL ini sesuai dengan prefix router di app.js kamu
            // Misal: app.use('/admin/verifikasi', verifikasiRouter) -> maka URLnya /admin/verifikasi/api/dosen
            const res = await fetch('/admin/verifikasi/api/dosen'); 
            const json = await res.json();
            
            if (!json.success) throw new Error("Gagal load dosen");

            select.innerHTML = '<option value="">-- Pilih Dosen Penguji --</option>';
            
            (json.data || []).forEach(d => {
                const labelKode = d.kode_dosen ? `[${d.kode_dosen}]` : '';
                const option = document.createElement('option');
                option.value = d.id; 
                option.text = `${labelKode} ${d.nama}`;
                select.appendChild(option);
            });
        } catch(e) { 
            console.error('Gagal ambil data dosen:', e); 
            select.innerHTML = '<option value="">Gagal memuat dosen</option>';
            return; 
        }
    }

    // SET VALUE TERPILIH (PENTING!)
    // Pastikan value berupa string agar perbandingannya cocok
    if (selectedId) {
        select.value = selectedId.toString(); 
    } else {
        select.value = "";
    }
};


// ===================================================
// EVENT: KLIK TOMBOL EDIT SURAT
// ===================================================
document.querySelectorAll('.btn-edit-surat').forEach(btn => {
  btn.addEventListener('click', async function() {
    const npm = this.dataset.npm;
    const modalEl = document.getElementById('modalEditSurat'); 
    const form = document.getElementById('formEditSurat');
    
    if(form) form.reset(); // Reset form dulu biar bersih

    try {
        // 1. Fetch Data Detail Mahasiswa
        const res = await fetch(`/admin/verifikasi/surat-detail/${npm}`);
        const json = await res.json();
        
        if (!json.success) throw new Error(json.message);
        
        const d = json.data;
        const j = d.jadwal;

        const dos1 = document.getElementById('display-dosbing1');
    const dos2 = document.getElementById('display-dosbing2');
    
    if (dos1) dos1.innerText = `1. ${d.dosbing1 || '-'}`;
    if (dos2) dos2.innerText = `2. ${d.dosbing2 || '-'}`;

        // 2. Isi Form (Pastikan ID input di modal.ejs cocok)
        document.getElementById('edit-mahasiswa-id').value = d.mahasiswa_id;
        document.getElementById('edit-jadwal-id').value = d.jadwal_id;
        
        // Handle Tanggal (Format YYYY-MM-DD)
        // Kadang DB return format ISO panjang, kita potong 10 karakter pertama
        if (j.tanggal_db) {
            document.getElementById('edit-tanggal').value = j.tanggal_db.substring(0, 10);
        }

        document.getElementById('edit-jam-mulai').value = j.jam_mulai || '';
        document.getElementById('edit-jam-selesai').value = j.jam_selesai || '';
        
        // Pelaksanaan & Toggle View
        const pelSelect = document.getElementById('edit-pelaksanaan');
        pelSelect.value = j.pelaksanaan || 'offline';
        window.toggleTempatEdit(pelSelect); // Panggil fungsi helper toggle UI

        document.getElementById('edit-tempat').value = j.tempat || '';
        document.getElementById('edit-link-zoom').value = j.linkZoom || '';
        document.getElementById('edit-meeting-id').value = j.meetingID || '';
        document.getElementById('edit-passcode').value = j.passcode || '';

        // 3. LOAD DOSEN & SET PILIHAN (Critical Step)
        // Kita await agar dropdown terisi DULU, baru diset value-nya
        await fetchDosenAndPopulate(d.penguji_id);

        // 4. Tampilkan Modal
        const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
        modalInstance.show();

    } catch (err) {
        console.error(err);
        alert('Gagal mengambil data: ' + err.message);
    }
  });
});

// ===================================================
// =============== 4. AUTO JAM SELESAI (+1 Jam) ======
// ===================================================
const inputMulai = document.getElementById('edit-jam-mulai');
if (inputMulai) {
    inputMulai.addEventListener('change', function() {
        const val = this.value;
        if(val) {
            const [h, m] = val.split(':').map(Number);
            const date = new Date();
            date.setHours(h + 1);
            date.setMinutes(m);
            const hh = String(date.getHours()).padStart(2,'0');
            const mm = String(date.getMinutes()).padStart(2,'0');
            document.getElementById('edit-jam-selesai').value = `${hh}:${mm}`;
        }
    });
}

// ===================================================
// 5. EVENT LISTENER: SIMPAN PERUBAHAN (SUBMIT FORM)
// ===================================================
document.body.addEventListener('submit', async function(e) {
    // Pastikan targetnya adalah form edit surat
    const form = e.target.closest('#formEditSurat');
    if (!form) return;

    e.preventDefault();

    const jadwalId = document.getElementById('edit-jadwal-id').value;
    
    // Validasi sederhana
    if(!jadwalId) {
        alert("ID Jadwal tidak ditemukan. Silakan refresh halaman.");
        return;
    }

    const btn = form.querySelector('button[type="submit"]'); // Selector button lebih aman
    const originalHtml = btn.innerHTML;
    
    btn.innerHTML = 'Menyimpan...';
    btn.disabled = true;

    const formData = new FormData(form);
    const dataKirim = Object.fromEntries(formData.entries());

    try {
        const response = await fetch(`/admin/verifikasi/update-surat-detail/${jadwalId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataKirim)
        });

        const result = await response.json();

        if (response.ok && result.success) {
            alert('Berhasil memperbarui surat!');
            window.location.reload();
        } else {
            throw new Error(result.message || 'Gagal update.');
        }
    } catch (error) {
        console.error('❌ Error submit:', error);
        alert('Gagal: ' + error.message);
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
});



  // ===================================================
  // =============== 4️⃣ UPLOAD LABEL HANDLER ===========
  // ===================================================
  // Fungsi helper (dipanggil kalau needed)
  window.handleUploadLabel = function(input) {
    const labelSpan = input.parentElement.querySelector('.label-text');
    const file = input.files[0];
    if (file && labelSpan) {
      labelSpan.textContent = file.name;
    }
  };


  // ===================================================
  // =============== 5️⃣ DELETE MODE HANDLER ============
  // ===================================================
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const table = document.querySelector('.container:not(.d-none) table');
      if (!table) {
        alert('Tabel tidak ditemukan.');
        return;
      }
      const deleteMode = table.classList.contains('delete-mode');

      // KELUAR MODE HAPUS
      if (deleteMode) {
        table.classList.remove('delete-mode');
        table.querySelectorAll('.delete-col').forEach(el => el.remove());
        btn.classList.remove('btn-warning');
        btn.innerHTML = '<i class="bi bi-trash"></i>';
        const btnGroup = btn.parentElement.querySelector('.delete-btn-group');
        if (btnGroup) btnGroup.remove();
        return;
      }

      // MASUK MODE HAPUS
      const existingGroup = btn.parentElement.querySelector('.delete-btn-group');
      if (existingGroup) existingGroup.remove();

      table.classList.add('delete-mode');
      const headerRow = table.querySelector('thead tr');
      const newTh = document.createElement('th');
      newTh.classList.add('delete-col', 'text-center');
      newTh.style.width = '2%';
      newTh.textContent = '🗑️';
      headerRow.appendChild(newTh);

      table.querySelectorAll('tbody tr').forEach(row => {
        const newTd = document.createElement('td');
        newTd.classList.add('delete-col', 'text-center', 'align-middle');
        newTd.innerHTML = '<input type="checkbox" class="form-check-input delete-check" style="transform:scale(0.9)">';
        row.appendChild(newTd);
      });

      btn.classList.add('btn-warning');
      btn.innerHTML = '<i class="bi bi-x-circle"></i> Batal';

      const btnGroup = document.createElement('div');
      btnGroup.className = 'delete-btn-group d-inline ms-2';
      btnGroup.innerHTML = `
      <button class="btn btn-danger btn-sm btn-hapus-pilih" data-bs-toggle="modal" data-bs-target="#modalHapus">
        <i class="bi bi-trash3"></i> Hapus yang Dipilih
      </button>
    `;
      btn.after(btnGroup);

      const hapusBtn = btnGroup.querySelector('.btn-hapus-pilih');
      hapusBtn.addEventListener('click', () => {
        const checked = table.querySelectorAll('.delete-check:checked');
        if (checked.length === 0) {
          alert('Pilih minimal satu data yang ingin dihapus!');
          const modalTarget = hapusBtn.getAttribute('data-bs-target');
          const modalEl = document.querySelector(modalTarget);
          const modal = bootstrap.Modal.getInstance(modalEl);
          if (modal) modal.hide();
          return;
        }
      });
    });
  });

  // ===================================================
  // =============== 6️⃣ KONFIRMASI HAPUS ===============
  // ===================================================
// button-handler.js

// ... (Kode untuk bagian 5️⃣ DELETE MODE HANDLER)

// ===================================================
// =============== 6️⃣ KONFIRMASI HAPUS (FINAL ROBUST) =
// ===================================================
document.querySelectorAll('.btn-confirm').forEach(btn => {
    btn.addEventListener('click', async () => {
      const modalId = btn.getAttribute('data-modal-id');
      const modalEl = document.getElementById(modalId);
      
      // 1. TENTUKAN KONTEKS HAPUS (Dosen atau Mahasiswa)
      let endpointPath;
      let consoleLabel;
      let identifierKey;
      
      // Cek URL untuk menentukan konteks (misalnya /admin/daftar-dosen atau /admin/daftar-mahasiswa)
      if (window.location.pathname.includes('/daftar-dosen')) {
          endpointPath = '/admin/dosen/';
          consoleLabel = 'dosen';
          identifierKey = 'kodeDosen'; // Dosen menggunakan Kode Dosen
      } else if (window.location.pathname.includes('/daftar-mahasiswa')) {
          endpointPath = '/admin/mahasiswa/';
          consoleLabel = 'mahasiswa';
          identifierKey = 'npm'; // Mahasiswa menggunakan NPM
      } else {
          // Jika bukan halaman Dosen atau Mahasiswa, hentikan proses
          return;
      }

      // Pastikan ini modal konfirmasi kita
      if (modalId !== 'modalHapus') return;

      const table = document.querySelector('.container:not(.d-none) table');
      const checkedRows = table ? table.querySelectorAll('.delete-check:checked') : [];
      
      if (checkedRows.length === 0) return;

      const deletePromises = [];
      const rowsToRemove = [];
      
      // 1. Tutup modal konfirmasi
      const modalInstance = bootstrap.Modal.getInstance(modalEl);
      if (modalInstance) modalInstance.hide();
      
      // 2. Kumpulkan promises penghapusan dan kirim request DELETE
      for (const chk of checkedRows) {
        const row = chk.closest('tr');
        // data-id berisi identifier (Kode Dosen atau NPM)
        const identifierValue = row?.dataset.id; 
        
        if (identifierValue) {
            deletePromises.push(
                fetch(`${endpointPath}${identifierValue}`, { // Menggunakan endpoint dinamis
                    method: 'DELETE'
                })
                .then(response => {
                    if (response.ok) {
                        rowsToRemove.push(row); 
                        return { success: true };
                    } else {
                        return response.json().then(error => {
                            throw new Error(error.message || `Gagal menghapus ${identifierValue}`);
                        });
                    }
                })
                .catch(error => {
                    console.error(`❌ Gagal hapus ${consoleLabel}:`, identifierValue, error.message);
                    return { success: false, error: error.message };
                })
            );
        }
      }

      // 3. Tunggu semua permintaan selesai
      const results = await Promise.all(deletePromises);
      
      // 4. Hapus baris dari DOM yang berhasil dihapus dari DB
      rowsToRemove.forEach(row => row.remove());
      
      // 5. Tampilkan pesan hasil
      const successCount = rowsToRemove.length;
      const failureCount = results.length - successCount;

      let message = `${successCount} data berhasil dihapus.`;
      
      if (failureCount > 0) {
          message += ` ${failureCount} data gagal dihapus (mungkin terikat data lain, cek console untuk detail).`;
          alert(message);
      } else {
          // Tampilkan modal sukses
          const modalSukses = document.getElementById('modalSukses');
          if (modalSukses) {
            const suksesInstance = new bootstrap.Modal(modalSukses);
            suksesInstance.show();
            setTimeout(() => suksesInstance.hide(), 2000);
            document.querySelectorAll('.modal-backdrop').forEach(el => el.remove()); 
          }
      }
      
    });
});


  // ===================================================
  // =============== 7️⃣ INLINE DONE / STATUS LABEL =====
  // ===================================================
  document.querySelectorAll('.btn-done').forEach(btn => {
    btn.addEventListener('click', () => {
      const mahasiswaId = btn.closest('.mahasiswa-item').dataset.id;
      const modalSelector = btn.dataset.target;
      const modalEl = document.querySelector(modalSelector);
      if (!modalEl) return;

      modalEl.dataset.mahasiswaId = mahasiswaId;
      new bootstrap.Modal(modalEl).show();
    });
  });

  // Logic Tombol Konfirmasi Selesai
  const btnConfirmDone = document.querySelector('#modalConfirmDone .btn-confirm-done');
  if (btnConfirmDone) {
    btnConfirmDone.addEventListener('click', async (e) => {
      const modalEl = e.target.closest('.modal');
      const mahasiswaId = modalEl.dataset.mahasiswaId;

      if (!mahasiswaId) return;

      try {
        const resp = await fetch('/admin/verifikasi/tandai-selesai', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            mahasiswaId
          })
        });
        const data = await resp.json();

        if (data.success) {
          const itemEl = document.querySelector(`.mahasiswa-item[data-id='${mahasiswaId}']`);
          if (itemEl) itemEl.remove();
          bootstrap.Modal.getInstance(modalEl).hide();
        } else {
          alert(data.message || 'Gagal menandai selesai');
        }
      } catch (err) {
        console.error(err);
        alert('Gagal mengirim data ke server');
      }
    });
  }

  // ===================================================
  // =============== 8️⃣ KEMBALIKAN BERKAS (CATATAN) ===
  // ===================================================
  document.querySelectorAll('.btn-kirim-catatan').forEach(btn => {
    btn.addEventListener('click', async () => {
      const modalId = btn.dataset.modalId;
      const npm = btn.dataset.npm;
      const selectEl = document.querySelector(`#formSelect-${modalId}`);
      const selectedValue = selectEl ? selectEl.value : '';

      if (!selectedValue || selectedValue === '[pilih alasan]') {
        alert('Silakan pilih alasan pengembalian berkas.');
        return;
      }

      let pesanCatatan = '';
      if (selectedValue === '1') pesanCatatan = 'Berkas yang diupload salah/tidak sesuai.';
      else if (selectedValue === '2') pesanCatatan = 'Scan berkas kurang jelas/buram.';
      else if (selectedValue === '3') pesanCatatan = 'Mohon lengkapi tanda tangan/stempel.';
      else pesanCatatan = 'Perbaiki berkas Anda.';

      try {
        const res = await fetch(`/admin/verifikasi/cek-berkas/${npm}/kembalikan`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            npm: npm,
            catatan: pesanCatatan
          }),
        });

        if (res.ok || res.redirected) {
          const modalEl = document.getElementById(modalId);
          const modalInstance = bootstrap.Modal.getInstance(modalEl);
          if (modalInstance) modalInstance.hide();

          const modalSukses = new bootstrap.Modal(document.getElementById('modalSukses'));
          modalSukses.show();

          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          alert('Gagal mengembalikan berkas.');
        }
      } catch (err) {
        console.error(err);
        alert('Terjadi kesalahan koneksi.');
      }
    });
  });


  // B. LISTENER FILE BERUBAH -> SUBMIT FORM
  document.body.addEventListener('change', function(e) {
    if (e.target && e.target.id && e.target.id.startsWith('fileInput-')) {
      const namaFile = e.target.id.replace('fileInput-', '');
      const form = document.getElementById('uploadForm-' + namaFile);
      const btn = document.getElementById('uploadBtn-' + namaFile);
      
      if (form) {
        // Ubah tombol jadi loading
        if (btn) {
            // Simpan lebar asli
            const width = btn.offsetWidth;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
            btn.style.width = width + 'px'; // Kunci lebar biar ga gerak
            btn.classList.add('disabled');
        }
        form.submit(); 
      }
    }
  });

  // B. Listener Change Input (Auto Submit)
  document.body.addEventListener('change', function(e) {
    // Cek apakah yang berubah adalah input file kita
    if (e.target && e.target.id && e.target.id.startsWith('fileInput-')) {
      const namaFile = e.target.id.replace('fileInput-', '');
      const form = document.getElementById('uploadForm-' + namaFile);
      
      if (form) {
        // Submit form otomatis
        form.submit(); 
      }
    }
  });

});

