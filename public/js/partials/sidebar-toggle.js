document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggleSidebar'); // tombol garis 3
  const sidebar = document.querySelector('.sidebar');
  const content = document.querySelector('.content');
  const toggleDaftar = document.getElementById('toggleDaftar'); // tombol daftar
  const daftarSubmenu = document.getElementById('daftarSubmenu');

  let sidebarUserToggled = false; // track toggle manual sidebar
  let daftarUserToggled = false;  // track toggle manual submenu

  // === Sidebar hide/show ===
  if (toggleBtn && sidebar && content) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('hide');
      content.classList.toggle('full');
      sidebarUserToggled = true;
    });
  }

  // === Submenu toggle ===
  if (toggleDaftar && daftarSubmenu) {
    toggleDaftar.addEventListener('click', (e) => {
      e.preventDefault();
      daftarSubmenu.classList.toggle('open'); // class "open" = tampil
      daftarUserToggled = true;
    });
  }

  // === Responsive default (tanpa ganggu toggle manual) ===
  function handleResize() {
    // Sidebar: auto muncul desktop, auto sembunyi mobile (kecuali user toggle)
    if (!sidebarUserToggled) {
      if (window.innerWidth >= 768) {
        sidebar.classList.remove('hide');
        content.classList.remove('full');
      } else {
        sidebar.classList.add('hide');
        content.classList.add('full');
      }
    }

    // Submenu: auto terbuka desktop, auto tertutup mobile (kecuali user toggle)
    if (!daftarUserToggled) {
      if (window.innerWidth >= 768) {
        daftarSubmenu?.classList.add('open');
      } else {
        daftarSubmenu?.classList.remove('open');
      }
    }
  }

  window.addEventListener('resize', handleResize);
  handleResize(); // panggil pertama kali
});
