document.addEventListener('DOMContentLoaded', () => {
    // Inisialisasi Elemen
    const sidebar = document.getElementById('sidebarMain');
    const toggleBtn = document.getElementById('toggleSidebar');
    const toggleDaftar = document.getElementById('toggleDaftar');
    const daftarSubmenu = document.getElementById('daftarSubmenu');
    const iconDropdown = document.getElementById('iconDropdown');

    // Variabel state untuk menghindari bentrok antara resize otomatis dan klik manual
    let sidebarUserToggled = localStorage.getItem('sidebarUserToggled') === 'true';
    let daftarUserToggled = false;

    // === 1. LOGIKA SIDEBAR TOGGLE (PUSH CONTENT) ===
    if (toggleBtn && sidebar) {
        // Cek status terakhir dari localStorage saat halaman dimuat
        const savedState = localStorage.getItem('sidebarCollapsed');
        if (savedState === 'true') {
            sidebar.classList.add('collapsed');
        }

        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            
            // Tandai bahwa user sudah melakukan aksi manual
            sidebarUserToggled = true;
            localStorage.setItem('sidebarUserToggled', 'true');
            
            // Simpan status collapsed saat ini
            const isCollapsed = sidebar.classList.contains('collapsed');
            localStorage.setItem('sidebarCollapsed', isCollapsed);
        });
    }

    // === 2. LOGIKA SUBMENU TOGGLE (DOSEN & MAHASISWA) ===
    if (toggleDaftar && daftarSubmenu) {
        toggleDaftar.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Cek status display menggunakan getComputedStyle untuk akurasi tinggi
            const isHidden = window.getComputedStyle(daftarSubmenu).display === 'none';
            
            if (isHidden) {
                daftarSubmenu.style.display = 'block';
                if (iconDropdown) {
                    iconDropdown.classList.replace('bi-caret-down-fill', 'bi-caret-up-fill');
                }
            } else {
                daftarSubmenu.style.display = 'none';
                if (iconDropdown) {
                    iconDropdown.classList.replace('bi-caret-up-fill', 'bi-caret-down-fill');
                }
            }
            
            // Tandai user sudah berinteraksi dengan submenu
            daftarUserToggled = true;
        });
    }

    // === 3. LOGIKA RESPONSIVE (HANDLE AUTO-RESIZE) ===
    function handleResize() {
        const width = window.innerWidth;

        // Atur Sidebar otomatis jika user belum pernah klik manual di sesi ini
        if (!sidebarUserToggled && sidebar) {
            if (width < 992) { // Ambang batas Tablet/Mobile
                sidebar.classList.add('collapsed');
            } else {
                sidebar.classList.remove('collapsed');
            }
        }

        // Atur Submenu otomatis jika user belum pernah klik manual
        if (!daftarUserToggled && daftarSubmenu) {
            if (width < 768) {
                daftarSubmenu.style.display = 'none';
                if (iconDropdown) {
                    iconDropdown.classList.replace('bi-caret-up-fill', 'bi-caret-down-fill');
                }
            } else {
                // Tetap buka di desktop kecuali jika tidak ada halaman aktif di dalamnya
                const isActive = daftarSubmenu.dataset.active === 'true';
                if (isActive) {
                    daftarSubmenu.style.display = 'block';
                    if (iconDropdown) {
                        iconDropdown.classList.replace('bi-caret-down-fill', 'bi-caret-up-fill');
                    }
                }
            }
        }
    }

    // Event Listener untuk Resize jendela
    window.addEventListener('resize', handleResize);
    
    // Jalankan handleResize sekali saat pertama kali load untuk menyesuaikan tampilan awal
    handleResize();
});