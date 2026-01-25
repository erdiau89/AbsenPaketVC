
import { AttendanceRecord } from '../types';

/**
 * URL Google Apps Script Web App Anda.
 * Deploy skrip ini di akun Google tujuan (tempat Sheet & Drive berada).
 * Pastikan akses diatur ke "Anyone" agar aplikasi bisa mengirim data.
 */
const GOOGLE_SCRIPT_URL = 'YOUR_APPS_SCRIPT_WEB_APP_URL';

export const submitToGoogleSheets = async (record: AttendanceRecord): Promise<boolean> => {
  console.log("Menghubungkan ke Cloud Server (Akun Eksternal)...", record.studentName);

  // Jika URL belum diisi, kita tetap gunakan simulasi sukses agar aplikasi tidak error saat testing
  if (GOOGLE_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL') {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return true; 
  }

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors', // Penting untuk Google Apps Script
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });

    // Karena mode 'no-cors', kita tidak bisa membaca response body secara detail,
    // tapi biasanya jika tidak ada error network, pengiriman dianggap berhasil.
    return true;
  } catch (error) {
    console.error("Gagal sinkronisasi cloud:", error);
    return false; // Tetap simpan di lokal jika gagal
  }
};
