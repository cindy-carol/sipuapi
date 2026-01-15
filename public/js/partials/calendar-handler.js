document.addEventListener("DOMContentLoaded", () => {
  const wrapper = document.getElementById("calendarWrapper");
  if (!wrapper) return;

  const calendarEl = document.getElementById("calendar");
  const role = wrapper.dataset.role;
  const currentUserNPM = wrapper.dataset.userNpm;

  // ============================================================
  // [UPDATE] CSS INJECT (HOVER SLOT + SOLID PREVIEW)
  // ============================================================
  const style = document.createElement('style');
  style.innerHTML = `
    /* 1. Preview Pilihan: SOLID (Tidak Transparan) & Tembus Klik */
    .fc-event-preview { 
      pointer-events: none !important; 
      opacity: 1 !important; 
      z-index: 1;
      border: 2px dashed black !important;
    }

    /* 2. Cursor Tangan di Event */
    .clickable-event { 
      cursor: pointer; 
    }

    /* 3. Efek Hover di Slot Kosong (Per Baris/Jam) */
    .fc-timegrid-slot-lane:hover {
      background-color: rgba(255, 193, 7, 0.25) !important; /* Kuning Hover */
      cursor: pointer;
      transition: background-color 0.1s;
    }
  `;
  document.head.appendChild(style);

  // ===== AMBIL DATA DENGAN AMAN =====
  let eventsData = [], myDosenIds = [];
  try {
    eventsData = JSON.parse(wrapper.dataset.events || "[]");
    myDosenIds = JSON.parse(wrapper.dataset.myDosen || "[]");
  } catch (e) { console.error("❌ Gagal parsing data kalender:", e); }

  // ===== CONFIG DASAR =====
  const config = {
    locale: "id",
    height: 550,
    nowIndicator: true,
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek", 
    },
  };

  // ============================================================
  // 🎨 LOGIKA 1: ADMIN (TAMPILAN LENGKAP)
  // ============================================================
  if (role === "admin") {
    config.initialView = "dayGridMonth";
    config.headerToolbar.right = "dayGridMonth,timeGridWeek,timeGridDay,listMonth";

    const adminEvents = eventsData.map(e => {
      const p = e.extendedProps;
      e.textColor = '#ffffff';
      e.classNames = [];
      if (p.status === 'confirmed') {
        e.backgroundColor = p.mode === 'offline' ? '#10b981' : '#3b82f6';
        e.borderColor = p.mode === 'offline' ? '#10b981' : '#3b82f6';
      } else {
        e.backgroundColor = '#8f979c';
        e.borderColor = '#8f979c';
      }
      e.classNames.push('event-tag');
      return e;
    });

    config.events = adminEvents;

    config.eventClick = function(info) {
      const props = info.event.extendedProps;
      const start = new Date(info.event.start);
      const end = new Date(info.event.end);
      const optionsDate = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
      
      document.getElementById("modalTime").innerText = `${start.toLocaleDateString("id-ID", optionsDate)}, ${start.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB`;
      document.getElementById("modalTitle").innerText = info.event.title;
      document.getElementById("modalPeriode").innerText = props.tahun_ajaran || '-';
      document.getElementById("modalDospem1").innerText = props.dosbing1 || '-';
      document.getElementById("modalDospem2").innerText = props.dosbing2 || '-';
      document.getElementById("modalDospenguji").innerText = props.penguji || '-';
      document.getElementById("modalPlace").innerText = props.tempat || '-';

      const modal = new bootstrap.Modal(document.getElementById('modalCalendar'));
      modal.show();
    };
  }

  // ============================================================
  // 🎨 LOGIKA 2: MAHASISWA (TAMPILAN SIMPEL + FITUR BAJAK)
  // ============================================================
  if (role === "mahasiswa") {
    config.initialView = "timeGridWeek";
    config.headerToolbar.right = "dayGridMonth,timeGridWeek";

    config.allDaySlot = false;
    config.selectable = true;
    config.selectMirror = false; 
    config.eventOverlap = true;
    
    config.businessHours = { daysOfWeek: [1, 2, 3, 4, 5], startTime: "08:00", endTime: "17:00" };
    config.slotMinTime = "08:00:00";
    config.slotMaxTime = "17:00:00";

    // --- MAPPING WARNA ---
// --- MAPPING WARNA (Sesuai Legenda: Hijau=ACC, Kuning=Antre, Gelap=Terisi) ---
const mhsEvents = eventsData.map(e => {
  const p = e.extendedProps;
  const isMine = (p.owner === currentUserNPM);
  const mode = p.mode ? p.mode.toLowerCase() : 'offline'; // 👈 Ambil mode pelaksanaan

  if (isMine) {
    // 🛡️ LOGIKA JADWAL SAYA
    // 🔥 SINKRONISASI WARNA: Online Biru, Offline Hijau
    if (mode === 'online') {
      e.backgroundColor = '#006dc1'; // Biru (Info)
      e.borderColor = '#006dc1';
      e.textColor = '#000000';      // Teks hitam agar terbaca jelas di biru muda
    } else {
      e.backgroundColor = '#198754'; // Hijau (Success)
      e.borderColor = '#198754';
      e.textColor = '#ffffff';
    }

    // 🔥 TAMBAH KETERANGAN PELAKSANAAN & STATUS
    const statusText = p.status === 'confirmed' ? 'ACC' : 'Proses';
    const modeText = mode.toUpperCase();
    e.title = `Jadwal Anda: ${modeText} (${statusText})`; 

  } else {
    // 👤 JADWAL ORANG LAIN: Warna redup agar tidak tertukar
    if (mode === 'offline') {
      e.backgroundColor = '#495057'; // Abu-abu Gelap
      e.borderColor = '#495057';
      e.title = "TERISI (OFFLINE)";
    } else {
      e.backgroundColor = '#e9ecef'; // Abu-abu Terang
      e.borderColor = '#ced4da';
      e.textColor = '#6c757d';
      e.title = "TERISI (ONLINE)";
    }
    e.classNames = ['clickable-event'];
  }
  return e;
});

    const breakEvents = [1, 2, 3, 4, 5].map(day => ({
      title: "Jam Istirahat", daysOfWeek: [day], startTime: "12:00", endTime: "13:00", display: "background", color: "#f8d7da",
    }));

    config.events = [...mhsEvents, ...breakEvents];

    // --- FUNGSI UTAMA BOOKING (Validasi & Preview) ---
    const handleBookingProcess = (start) => {
        const inputModeEl = document.querySelector('input[name="pelaksanaan"]:checked');
        const inputMode = inputModeEl ? inputModeEl.value : 'offline';

        // Validasi Dasar
        if (start.getDay() === 0 || start.getDay() === 6) { alert("Libur"); if(calendar.unselect) calendar.unselect(); return; }
        if (start.getHours() >= 12 && start.getHours() < 13) { alert("Istirahat"); if(calendar.unselect) calendar.unselect(); return; }

        // Validasi Bentrok
        const allEvents = calendar.getEvents();
        const conflict = allEvents.find(event => {
          if (event.display === 'background' || event.id === 'preview-event') return false;
          const eventEnd = event.end || new Date(event.start.getTime() + 3600000);
          const isTimeOverlap = (start < eventEnd && new Date(start.getTime() + 3600000) > event.start);
          if (!isTimeOverlap) return false;

          const p = event.extendedProps;
          if (inputMode === 'offline' && p.mode === 'offline') return true;
          const isDosenClash = myDosenIds.some(myId => (p.dosenTerlibat || []).includes(myId));
          if (isDosenClash) return true;
          return false;
        });

        if (conflict) {
          const p = conflict.extendedProps;
          let msg = "Slot tidak tersedia.";
          if (inputMode === 'offline' && p.mode === 'offline') msg = "Ruangan fisik (Offline) penuh.";
          else msg = "Dosen pembimbing Anda sibuk.";
          alert(msg);
          if(calendar.unselect) calendar.unselect();
          return;
        }

        // Isi Form
        const year = start.getFullYear();
        const month = String(start.getMonth() + 1).padStart(2, '0');
        const day = String(start.getDate()).padStart(2, '0');
        const h = String(start.getHours()).padStart(2, '0');
        const m = String(start.getMinutes()).padStart(2, '0');

        // 🔥 [PERBAIKAN] Ubah selector sesuai name di HTML baru
        const iTgl = document.querySelector('input[name="tanggal"]');  
        const iWkt = document.querySelector('input[name="jamMulai"]'); 
        
        if(iTgl) iTgl.value = `${year}-${month}-${day}`;
        if(iWkt) iWkt.value = `${h}:${m}`;
        
        // Trigger event change biar validasi form jalan
        if(iTgl) iTgl.dispatchEvent(new Event('change'));
        if(iWkt) iWkt.dispatchEvent(new Event('change'));

        // Preview Kuning (Pilihan User)
        const old = calendar.getEventById('preview-event');
        if (old) old.remove();

        calendar.addEvent({
          id: 'preview-event',
          title: 'Pilihan Anda',
          start: start,
          end: new Date(start.getTime() + 3600000),
          backgroundColor: '#ffc107',
          borderColor: '#ffc107',
          textColor: '#000',
          classNames: ['fc-event-preview'] 
        });
    };

    // --- 1. LOGIKA KLIK KOSONG (SELECT) ---
    config.select = function(info) {
        handleBookingProcess(info.start);
    };

    // --- 2. LOGIKA KLIK EVENT (BAJAK) ---
    config.eventClick = function(info) {
        info.jsEvent.preventDefault();
        const p = info.event.extendedProps;
        if (info.event.id === 'preview-event') return;

        const isMine = (p.owner === currentUserNPM);
        if (!isMine) {
             handleBookingProcess(info.event.start);
        }
    };

    // ============================================================
    // [BARU] FITUR TOMBOL RESET
    // ============================================================
    const btnReset = document.getElementById('btnReset');
    
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        // 1. Bersihkan Form Input
        // 🔥 [PERBAIKAN] Ubah selector sesuai name di HTML baru
        const iTgl = document.querySelector('input[name="tanggal"]');
        const iWkt = document.querySelector('input[name="jamMulai"]');
        
        const iTempatDisplay = document.getElementById('tempatDisplay');
        const iTempatInput = document.getElementById('tempatInput');
        const rOff = document.getElementById('modeOffline');
        const rOn = document.getElementById('modeOnline');
        const msg = document.getElementById('msgRuangan');

        if (iTgl) iTgl.value = '';
        if (iWkt) iWkt.value = '';
        
        // 2. Hapus Kotak Kuning (Preview) di Kalender
        const previewEvent = calendar.getEventById('preview-event');
        if (previewEvent) {
          previewEvent.remove();
        }

        // 3. Reset Radio Button & UI Lainnya
        if (rOff) {
          rOff.disabled = false;    
          rOff.checked = false;     
        }
        if (rOn) rOn.checked = false; 
        
        if (iTempatDisplay) iTempatDisplay.innerText = '-'; 
        if (iTempatInput) iTempatInput.value = '';
        if (msg) msg.classList.add('d-none'); 

        // 4. Hapus Highlighter
        const highlighter = document.getElementById('fc-cell-highlighter');
        if (highlighter) highlighter.remove();
      });
    }
  }

  // ===== RENDER =====
  const calendar = new FullCalendar.Calendar(calendarEl, config);
  calendar.render();

  // ===== LISTENER INPUT =====
  document.addEventListener('updateCalendarDate', (e) => {
    const { date, time } = e.detail;
    if (date) {
      calendar.gotoDate(date);
      if (time) {
        const start = new Date(`${date}T${time}`);
        if (!isNaN(start.getTime())) {
          const old = calendar.getEventById('preview-event');
          if (old) old.remove();
          calendar.addEvent({
            id: 'preview-event', title: 'Pilihan Form', start: start, end: new Date(start.getTime() + 3600000), backgroundColor: '#ffc107', textColor: '#000',
            classNames: ['fc-event-preview']
          });
          calendar.scrollToTime(time);
        }
      }
    }
  });
});