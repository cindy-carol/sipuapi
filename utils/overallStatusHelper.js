function getOverallStatus(row) {
  if (!row.sudah_upload_berkas) {
    row.status = "Belum upload berkas";
  } else if (!row.berkas_verified) {
    row.status = "Menunggu verifikasi berkas";
  } else if (!row.sudah_daftar_jadwal) {
    row.status = "Menunggu pendaftaran jadwal";
  } else if (!row.jadwal_verified) {
    row.status = "Menunggu verifikasi jadwal";
  } else if (!row.punya_penguji) {
    row.status = "Menunggu dosen penguji";
  } else if (!row.punya_surat) {
    row.status = "Menunggu surat penguji";
  } else if (!row.ujian_selesai) {
    row.status = "Menunggu ujian selesai";
  } else {
    row.status = "Selesai";
  }

  return row;
}
