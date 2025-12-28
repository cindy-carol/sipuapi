const { format } = require('date-fns');
const { id } = require('date-fns/locale');

// fungsi bantu: kapitalisasi huruf pertama
function capitalizeFirst(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatJadwal({ tanggal, jam_mulai, jam_selesai }) {
  if (!tanggal || !jam_mulai || !jam_selesai) return '-';

  try {
    const start = new Date(tanggal);
    const [sh, sm] = jam_mulai.split(':').map(Number);
    start.setHours(sh, sm, 0);

    const end = new Date(tanggal);
    const [eh, em] = jam_selesai.split(':').map(Number);
    end.setHours(eh, em, 0);

    // format tanggal & jam
    let startFormatted = format(start, "EEEE, dd MMMM yyyy HH:mm", { locale: id });
    const endFormatted = format(end, "HH:mm");

    // ubah kapital huruf pertama (misal “kamis” → “Kamis”)
    startFormatted = capitalizeFirst(startFormatted);

    return `${startFormatted} s/d ${endFormatted} WIB`;
  } catch (err) {
    console.error('Error formatJadwal:', err);
    return '-';
  }
}

module.exports = formatJadwal;
