document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggleSidebar'); 
  const sidebar = document.getElementById('sidebarMain'); // Sesuaikan ID
  const toggleDaftar = document.getElementById('toggleDaftar'); 
  const daftarSubmenu = document.getElementById('daftarSubmenu');
  const iconDropdown = document.getElementById('iconDropdown');

  let sidebarUserToggled = false; 
  let daftarUserToggled = false;  

  // === Sidebar Toggle (Push Content) ===
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed'); // Gunakan collapsed sesuai CSS
      sidebarUserToggled = true;
    });
  }

  // === Submenu Toggle (Dosen & Mahasiswa) ===
  if (toggleDaftar && daftarSubmenu) {
    toggleDaftar.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Gunakan style.display karena di EJS ada inline style 
      const isHidden = (daftarSubmenu.style.display === 'none' || daftarSubmenu.style.display === '');
      daftarSubmenu.style.display = isHidden ? 'block' : 'none';
      
      // Update Icon Panah [cite: 9]
      if (iconDropdown) {
        iconDropdown.classList.toggle('bi-caret-down-fill', !isHidden);
        iconDropdown.classList.toggle('bi-caret-up-fill', isHidden);
      }
      
      daftarUserToggled = true;
    });
  }

  // === Responsive Handle ===
  function handleResize() {
    if (!sidebarUserToggled && sidebar) {
      if (window.innerWidth < 768) {
        sidebar.classList.add('collapsed');
      } else {
        sidebar.classList.remove('collapsed');
      }
    }

    if (!daftarUserToggled && daftarSubmenu) {
      if (window.innerWidth < 768) {
        daftarSubmenu.style.display = 'none';
      } else {
        // Cek jika halaman aktif adalah bagian dari daftar, maka tetap buka 
        const isActive = daftarSubmenu.dataset.active === 'true'; 
        if (!isActive) daftarSubmenu.style.display = 'block';
      }
    }
  }

  window.addEventListener('resize', handleResize);
  handleResize(); 
});