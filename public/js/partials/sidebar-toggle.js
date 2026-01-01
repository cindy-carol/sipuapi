document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebarMain');
    const toggleBtn = document.getElementById('toggleSidebar');
    const toggleDaftar = document.getElementById('toggleDaftar');
    const daftarSubmenu = document.getElementById('daftarSubmenu');
    const iconDropdown = document.getElementById('iconDropdown');

    // === 1. FUNGSI PENENTU STATUS AWAL (PINTAR) ===
    function applyInitialState() {
        const isMobile = window.innerWidth < 992; // Deteksi HP/Tablet
        const savedState = localStorage.getItem('sidebarCollapsed') === 'true';

        if (isMobile) {
            // HP: WAJIB tutup biar gak nindih konten
            sidebar.classList.add('collapsed');
        } else {
            // WEB: Pakai memori terakhir kalau ada
            if (savedState) {
                sidebar.classList.add('collapsed');
            } else {
                sidebar.classList.remove('collapsed');
            }
        }
    }

    if (toggleBtn && sidebar) {
        // Matikan transisi sebentar pas awal load biar gak kedap-kedip
        sidebar.style.transition = 'none';
        applyInitialState();
        setTimeout(() => { sidebar.style.transition = 'margin-left 0.3s ease'; }, 50);

        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            
            // Simpan memori HANYA jika klik dilakukan di layar lebar (Web)
            if (window.innerWidth >= 992) {
                localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
            }
        });
    }

    // === 2. LOGIKA SUBMENU ===
    if (toggleDaftar && daftarSubmenu) {
        toggleDaftar.addEventListener('click', (e) => {
            e.preventDefault();
            const isHidden = window.getComputedStyle(daftarSubmenu).display === 'none';
            daftarSubmenu.style.display = isHidden ? 'block' : 'none';
            
            if (iconDropdown) {
                iconDropdown.classList.toggle('bi-caret-down-fill', !isHidden);
                iconDropdown.classList.toggle('bi-caret-up-fill', isHidden);
            }
        });
    }

    // === 3. AUTO-HIDE PAS RESIZE (BIAR DINAMIS) ===
    window.addEventListener('resize', () => {
        if (window.innerWidth < 992) {
            sidebar.classList.add('collapsed');
        } else {
            // Balikin ke status yang disimpan pas balik ke layar lebar
            if (localStorage.getItem('sidebarCollapsed') === 'false') {
                sidebar.classList.remove('collapsed');
            }
        }
    });
});