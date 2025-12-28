document.addEventListener("DOMContentLoaded", () => {
  // Cari semua form yang ID-nya diawali 'uploadForm-'
  document.querySelectorAll('form[id^="uploadForm-"]').forEach(uploadForm => {
    
    const namaFile = uploadForm.id.replace('uploadForm-', '');
    const uploadBtn = document.getElementById(`uploadBtn-${namaFile}`);
    const fileInput = document.getElementById(`fileInput-${namaFile}`);

    // Cek apakah elemennya ada (biar gak error di console)
    if (!uploadBtn || !fileInput) return;

    // 1. EVENT KLIK TOMBOL -> BUKA FILE EXPLORER
    // Kita pakai onclick di JS biar bersih dari HTML
    uploadBtn.addEventListener("click", (e) => {
      e.preventDefault(); // Mencegah tombol submit sendiri
      fileInput.click();  // Memicu input file yang hidden
    });

    // 2. EVENT FILE DIPILIH -> LANGSUNG UPLOAD
    fileInput.addEventListener("change", () => {
      // Cek apakah user beneran milih file
      if (fileInput.files && fileInput.files.length > 0) {
        
        // (Opsional) Ubah tampilan tombol biar user tau lagi loading
        uploadBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Uploading...';
        uploadBtn.classList.add('disabled');

        // LAKUKAN SUBMIT FORM STANDAR
        // Ini akan me-reload halaman, dan controller (res.redirect) akan bekerja.
        // Setelah reload, EJS akan membaca database dan merender tombol HIJAU secara otomatis.
        uploadForm.submit();
      }
    });
  });
});

document.addEventListener('DOMContentLoaded', () => {
    // Cari tombol hapus yg spesifik ini
    const btnHapus = document.querySelector(`.btn-delete-file[data-jenis="<%= jenisBerkas %>"]`);
    
    if (btnHapus) {
        btnHapus.addEventListener('click', async function() {
            const jenis = this.dataset.jenis;
            
            if(!confirm('Yakin ingin menghapus file ini? Data tidak bisa dikembalikan.')) return;

            // Efek Loading
            const originalHTML = this.innerHTML;
            this.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
            this.disabled = true;

            try {
                const response = await fetch('/mahasiswa/upload-berkas/delete', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ jenis_berkas: jenis })
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    // Refresh halaman biar statusnya update jadi "Belum Upload"
                    window.location.reload();
                } else {
                    alert('Gagal: ' + (result.message || 'Terjadi kesalahan'));
                    this.innerHTML = originalHTML;
                    this.disabled = false;
                }
            } catch (error) {
                console.error(error);
                alert('Gagal menghapus file. Cek koneksi server.');
                this.innerHTML = originalHTML;
                this.disabled = false;
            }
        });
    }
});