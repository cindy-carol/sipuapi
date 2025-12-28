document.addEventListener('DOMContentLoaded', () => {
  // 1. Registrasi Plugin DataLabels
  if (typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
  }

  const barCanvas = document.getElementById('barChart');
  const pieCanvas = document.getElementById('pieChart');

  // 2. ⚡ AMBIL BASE URL DINAMIS (KUNCI UTAMA) ⚡
  const baseUrlInput = document.getElementById('chartBaseUrl');
  
  // Kalau input ini gak ada, stop script
  if (!baseUrlInput) return; 
  
  const baseUrl = baseUrlInput.value; 

  // ==========================================
  // 3. 🔥 FIX FILTER TAHUN CHART
  // ==========================================
  const hiddenTahun = document.getElementById('selectedTahunId');
  const urlParams = new URLSearchParams(window.location.search);
  
  const tahunId = (hiddenTahun && hiddenTahun.value) 
                  ? hiddenTahun.value 
                  : urlParams.get('tahun_ajaran');

  const apiQuery = tahunId ? `?tahun=${tahunId}` : '';

  // ==========================================
  // 📊 BAR CHART (Tampilan Pendek & Rapi)
  // ==========================================
  if (barCanvas) {
    fetch(`${baseUrl}/bar${apiQuery}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        const ctx = barCanvas.getContext('2d');
        new Chart(ctx, {
          type: 'bar',
          data: {
            labels: data.map(d => d.label), 
            datasets: [{
              label: 'Jumlah Mahasiswa',
              data: data.map(d => d.jumlah),
              backgroundColor: ['#dc3545', '#0d6efd', '#ffc107', '#198754'],
              borderRadius: 5,
              barPercentage: 0.5,
              categoryPercentage: 0.8,
              maxBarThickness: 50
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            
            // ✅ POSISI BENAR: Di dalam options
            layout: {
                padding: {
                    top: 25, // Kasih jarak biar label gak kepotong
                    left: 0,
                    right: 0,
                    bottom: 0
                }
            },

            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
            plugins: { 
              legend: { display: false },
              datalabels: {
                anchor: 'end', align: 'top', color: '#333',
                font: { weight: 'bold', size: 12 },
                formatter: (value) => value > 0 ? value : ''
              }
            }
          }
        });
      })
      .catch(err => console.error("❌ Gagal Bar Chart:", err));
  }

  // ==========================================
  // 🍰 PIE CHART
  // ==========================================
  if (pieCanvas) {
    fetch(`${baseUrl}/pie${apiQuery}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        const ctx = pieCanvas.getContext('2d');
        new Chart(ctx, {
          type: 'pie',
          data: {
            labels: ['Upload Berkas', 'Upload Jadwal', 'Tunggu Penguji', 'Surat Terbit'],
            datasets: [{
              data: [data.upload_berkas, data.upload_jadwal, data.tunggu_penguji, data.surat_terbit],
              backgroundColor: ['#dc3545', '#ffc107', '#0dcaf0', '#198754'],
              borderWidth: 2, borderColor: '#ffffff'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: 15 },
            plugins: {
              legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15 } },
              datalabels: {
                color: '#fff', anchor: 'center', align: 'center',
                font: { weight: 'bold', size: 11 },
                formatter: (value, ctx) => value === 0 ? '' : ctx.chart.data.labels[ctx.dataIndex] + '\n(' + value + ')',
                textAlign: 'center'
              }
            }
          }
        });
      })
      .catch(err => console.error("❌ Gagal Pie Chart:", err));
  }
});