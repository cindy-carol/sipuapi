/**
 * MODAL HANDLER GLOBAL
 * Mengatur semua logika Modal, Form, dan Interaksi Halaman
 */

document.addEventListener('DOMContentLoaded', () => {

    // ============================================================
    // 1. LOGIKA MODAL UMUM (Form Select, Confirm, Lihat Berkas)
    // ============================================================

    // A. Form Select Type (Munculkan tombol kirim jika ada pilihan)
    document.querySelectorAll('.form-select').forEach(select => {
        const modalId = select.id.split('formSelect-')[1];
        if (!modalId) return;

        const btn = document.querySelector(`.btn-kirim[data-modal-id="${modalId}"]`);
        if (!btn) return;

        select.addEventListener('change', () => {
            btn.style.display = select.value ? 'inline-block' : 'none';
        });

        // Logika Tombol Kirim -> Modal Sukses
        btn.addEventListener('click', () => {
            const modalEl = document.getElementById(modalId);
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();
            showModalSukses();
        });
    });

    // B. Confirm Type (Tombol Konfirmasi Aksi)
    document.querySelectorAll('.btn-confirm').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.dataset.modalId;
            const modalEl = document.getElementById(modalId);
            if (!modalEl) return;

            const bsInstance = bootstrap.Modal.getInstance(modalEl);
            if (bsInstance) bsInstance.hide();

            const type = modalEl.dataset.type;

            if (type === 'done') {
                const targetBtn = document.getElementById(modalEl.dataset.targetBtn);
                if (targetBtn) {
                    targetBtn.className = 'btn btn-success';
                    targetBtn.innerHTML = 'Done <i class="bi bi-check2-circle me-1"></i>';
                }
            } else if (type === 'delete') {
                const table = document.querySelector(modalEl.dataset.deleteTarget);
                if (table) {
                    table.querySelectorAll('tbody tr input.delete-check:checked').forEach(chk => chk.closest('tr').remove());
                }
            }
            showModalSukses();
        });
    });

    // C. Lihat Berkas (Iframe Viewer)
    const lihatBtns = document.querySelectorAll('.btn-lihat-berkas');
    const iframe = document.getElementById('iframeBerkas');
    const modalBerkasEl = document.getElementById('modalBerkas');
    
    if (lihatBtns.length && iframe && modalBerkasEl) {
        const modal = new bootstrap.Modal(modalBerkasEl);
        lihatBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                iframe.src = btn.getAttribute('data-file');
                modal.show();
            });
        });
    }


    // ============================================================
    // 2. LOGIKA KELOLA AKUN (Admin, Edit, Verifikasi)
    // ============================================================

    // A. Toggle Password (Mata)
    const btnToggle = document.getElementById('btnTogglePassword');
    const inputPass = document.getElementById('adminPasswordInput');
    const iconEye = document.getElementById('iconEye');

    if (btnToggle && inputPass && iconEye) {
        btnToggle.addEventListener('click', function() {
            if (inputPass.type === 'password') {
                inputPass.type = 'text';
                iconEye.classList.replace('bi-eye', 'bi-eye-slash');
            } else {
                inputPass.type = 'password';
                iconEye.classList.replace('bi-eye-slash', 'bi-eye');
            }
        });
    }

    // B. Tambah Admin Baru
    const formTambah = document.getElementById('formTambahAdmin');
    if (formTambah) {
        formTambah.addEventListener('submit', async function(e) {
            e.preventDefault();
            await kirimDataForm(this, '/admin/kelola-akun/tambah');
        });
    }

    // C. Tombol Edit Akun (Isi Form & Buka Modal)
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            const nama = this.getAttribute('data-nama');
            const username = this.getAttribute('data-username');

            // Isi form edit
            const editId = document.getElementById('editId');
            const editNama = document.getElementById('editNama');
            const editUser = document.getElementById('editUsername');

            if (editId) editId.value = id;
            if (editNama) editNama.value = nama;
            if (editUser) editUser.value = username;

            // Tampilkan Modal Edit
            const modalEl = document.getElementById('modalEditAkun');
            if(modalEl) {
                const modalEdit = new bootstrap.Modal(modalEl);
                modalEdit.show();
            }
        });
    });

    // D. Submit Form Edit (Lanjut ke Verifikasi)
    const formEdit = document.getElementById('formEditAkun');
    if (formEdit) {
        formEdit.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Ambil data dari form
            const id = document.getElementById('editId').value;
            const nama = document.getElementById('editNama').value;
            const username = document.getElementById('editUsername').value;

            // Tutup Modal Edit
            const modalEl = document.getElementById('modalEditAkun');
            const modal = bootstrap.Modal.getInstance(modalEl);
            modal.hide();

            // Set Global Action untuk Verifikasi
            window.pendingAction = { 
                type: 'edit', 
                id: id, 
                payload: { nama: nama, username: username } 
            };

            // Buka Modal Verifikasi
            openModalVerifikasi();
        });
    }

    // E. Reset Modal Verifikasi saat ditutup
    const modalVerifEl = document.getElementById('modalVerifikasi');
    if (modalVerifEl) {
        modalVerifEl.addEventListener('hidden.bs.modal', function () {
            const inputPass = document.getElementById('adminPasswordInput');
            const alertBox = document.getElementById('alertWrongPass');
            const iconEye = document.getElementById('iconEye');
            
            if(inputPass) inputPass.value = '';
            if(alertBox) alertBox.classList.add('d-none');
            window.pendingAction = null;

            // Reset Mata ke Password
            if(inputPass) inputPass.type = 'password';
            if(iconEye) iconEye.classList.replace('bi-eye-slash', 'bi-eye');
        });
    }

    // ============================================================
    // 3. LOGIKA PROFILE UPDATE (AJAX)
    // ============================================================
    const formProfile = document.getElementById('formUpdateProfile');
    if (formProfile) {
        formProfile.addEventListener('submit', async function(e) {
            e.preventDefault();
            await kirimDataForm(this, '/profile/update', true); // True = mode profile
        });
    }

});


// ============================================================
// 4. GLOBAL HELPER FUNCTIONS (Diakses via onclick HTML)
// ============================================================

// Helper: Tampilkan Modal Sukses (Feedback Visual)
function showModalSukses() {
    const modalSukses = document.getElementById('modalSukses');
    if (modalSukses) {
        const suksesInstance = new bootstrap.Modal(modalSukses);
        suksesInstance.show();
        setTimeout(() => suksesInstance.hide(), 2000);
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
    }
}

// Helper: Buka Modal Verifikasi
function openModalVerifikasi() {
    const modalEl = document.getElementById('modalVerifikasi');
    if(modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

// Helper: Kirim Data Form via Fetch (Generic)
async function kirimDataForm(formEl, url, isProfileMode = false) {
    const formData = new FormData(formEl);
    const data = Object.fromEntries(formData.entries());
    
    // Khusus Profile: Handle UI Loading
    const btn = formEl.querySelector('button[type="submit"]');
    const alertBox = document.getElementById('profileAlert');
    let originalText = '';

    if(isProfileMode && btn) {
        originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Menyimpan...';
        if(alertBox) alertBox.classList.add('d-none');
    }

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const result = await res.json();
        
        if (result.success) {
            if(isProfileMode && alertBox) {
                alertBox.classList.remove('d-none', 'alert-danger');
                alertBox.classList.add('alert-success');
                alertBox.innerHTML = `<i class="bi bi-check-circle"></i> ${result.message}`;
                setTimeout(() => location.reload(), 1000);
            } else {
                alert(result.message);
                location.reload();
            }
        } else {
            if(isProfileMode && alertBox) {
                alertBox.classList.remove('d-none', 'alert-success');
                alertBox.classList.add('alert-danger');
                alertBox.innerHTML = `<i class="bi bi-exclamation-circle"></i> ${result.message}`;
            } else {
                alert('Error: ' + result.message);
            }
        }
    } catch (err) {
        console.error(err);
        if(isProfileMode && alertBox) {
            alertBox.classList.remove('d-none');
            alertBox.classList.add('alert-danger');
            alertBox.innerText = 'Gagal terhubung ke server.';
        } else {
            alert('Gagal menghubungi server.');
        }
    } finally {
        if(isProfileMode && btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

// Helper: Toggle Tempat Edit (Offline/Online) - Dipanggil via onchange HTML
window.toggleTempatEdit = function(selectEl) {
    const isOnline = selectEl.value === 'online';
    const offlineContainer = document.getElementById('tempat-offline-container');
    const onlineContainer = document.getElementById('tempat-online-container');
    const tempatInput = document.getElementById('edit-tempat');

    if (offlineContainer) offlineContainer.classList.toggle('d-none', isOnline);
    if (onlineContainer) onlineContainer.classList.toggle('d-none', !isOnline);

    if (tempatInput) {
        tempatInput.required = !isOnline;
        if (!isOnline) {
            if (tempatInput.value === '' || tempatInput.value === 'Online') {
                tempatInput.value = 'Ruang Sidang PSPPI, Gedung A FT Universitas Lampung';
            }
        } else {
            tempatInput.value = ''; 
        }
    }
};

// Helper: Enable Input (Profile)
window.enableInput = function(id) {
    const input = document.getElementById(id);
    if(input) {
        input.readOnly = false;
        input.focus();
        input.classList.remove('bg-light');
    }
}

// ============================================================
// 5. GLOBAL ACTION FUNCTIONS (KELOLA AKUN)
// ============================================================

window.pendingAction = null; // Variable global aksi sementara

// A. Reset Password (Trigger)
window.resetPassword = function(id, nama) {
    if (!confirm(`Yakin reset password ${nama} menjadi default?`)) return;
    window.pendingAction = { type: 'reset', id: id };
    openModalVerifikasi();
}

// B. Toggle Status Akun (Trigger)
window.toggleStatus = function(id, statusBaru, nama) {
    const action = statusBaru ? "MENGAKTIFKAN" : "MENGUNCI";
    if (!confirm(`Yakin ingin ${action} akun ${nama}?`)) return;
    window.pendingAction = { type: 'toggle', id: id, status: statusBaru };
    openModalVerifikasi();
}

// C. Submit Verifikasi (Eksekusi Akhir)
window.submitVerifikasi = async function() {
    const passwordInput = document.getElementById('adminPasswordInput');
    const alertBox = document.getElementById('alertWrongPass');
    const passwordAdmin = passwordInput ? passwordInput.value : '';
    
    if(!passwordAdmin) {
        alert("Harap isi password!");
        return;
    }

    // Siapkan Data Kirim
    let url = '';
    let bodyData = { 
        targetUserId: window.pendingAction.id, 
        adminPassword: passwordAdmin 
    };

    // Routing berdasarkan Tipe Aksi
    if (window.pendingAction.type === 'reset') {
        url = '/admin/kelola-akun/reset-password';
    } else if (window.pendingAction.type === 'toggle') {
        url = '/admin/kelola-akun/toggle-status';
        bodyData.statusBaru = window.pendingAction.status;
    } else if (window.pendingAction.type === 'edit') {
        url = '/admin/kelola-akun/update-data';
        bodyData.nama = window.pendingAction.payload.nama;
        bodyData.username = window.pendingAction.payload.username;
    }

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(bodyData)
        });
        const result = await res.json();

        if (result.success) {
            alert(result.message);
            location.reload();
        } else {
            if(alertBox) {
                alertBox.textContent = result.message;
                alertBox.classList.remove('d-none');
            } else {
                alert(result.message);
            }
        }
    } catch (err) {
        console.error(err);
        alert('Terjadi kesalahan server.');
    }
}

