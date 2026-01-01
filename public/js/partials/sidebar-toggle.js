document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebarMain');
    const toggleBtn = document.getElementById('toggleSidebar');
    const toggleDaftar = document.getElementById('toggleDaftar');
    const daftarSubmenu = document.getElementById('daftarSubmenu');
    const iconDropdown = document.getElementById('iconDropdown');

    // === 1. LOGIKA SIDEBAR TOGGLE ===
    if (toggleBtn && sidebar) {
        // Ambil status terakhir dari localStorage
        const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        
        // Terapkan langsung tanpa animasi pas pertama kali load biar gak kedap-kedip
        if (isCollapsed) {
            sidebar.style.transition = 'none';
            sidebar.classList.add('collapsed');
            // Balikin transisi setelah render pertama selesai
            setTimeout(() => { sidebar.style.transition = 'margin-left 0.3s ease'; }, 50);
        }

        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            // Simpan status terbaru
            localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
            // Kasih tau sistem kalau user sudah interaksi manual
            localStorage.setItem('sidebarUserToggled', 'true');
        });
    }

    // === 2. LOGIKA SUBMENU (DOSEN & MAHASISWA) ===
    if (toggleDaftar && daftarSubmenu) {
        toggleDaftar.addEventListener('click', (e) => {
            e.preventDefault();
            // Cek status display lewat computed style
            const isHidden = window.getComputedStyle(daftarSubmenu).display === 'none';
            
            if (isHidden) {
                daftarSubmenu.style.display = 'block';
                if (iconDropdown) iconDropdown.classList.replace('bi-caret-down-fill', 'bi-caret-up-fill');
            } else {
                daftarSubmenu.style.display = 'none';
                if (iconDropdown) iconDropdown.classList.replace('bi-caret-up-fill', 'bi-caret-down-fill');
            }
        });
    }

    // === 3. LOGIKA RESPONSIVE (AUTO-HIDE) ===
    function handleResize() {
        const userToggled = localStorage.getItem('sidebarUserToggled') === 'true';
        // Hanya jalankan auto-hide kalau user BELUM pernah klik tombol manual
        if (!userToggled && sidebar) {
            if (window.innerWidth < 992) {
                sidebar.classList.add('collapsed');
            } else {
                sidebar.classList.remove('collapsed');
            }
        }
    }

    window.addEventListener('resize', handleResize);
    handleResize(); 
});