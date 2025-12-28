
  document.addEventListener('DOMContentLoaded', () => {
    const switchButtons = document.querySelectorAll('[data-target]');
    switchButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        // Matikan semua tombol aktif
        switchButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Sembunyikan semua section yang jadi target
        switchButtons.forEach(b => {
          const section = document.getElementById(b.getAttribute('data-target'));
          if (section) section.classList.add('d-none');
        });

        // Tampilkan section target yang diklik
        const targetSection = document.getElementById(btn.getAttribute('data-target'));
        if (targetSection) targetSection.classList.remove('d-none');
      });
    });
  });
  