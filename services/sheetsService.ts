
import { AttendanceRecord } from '../types';

/**
 * URL Google Apps Script Web App Anda yang baru.
 * Pastikan Deployment disetel ke "Anyone" (Siapa saja) di Google Apps Script.
 */
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxqY6GbrFZtz7BDAmAtjuvT0ngL28H8ThM6GJS0bSclHfAJvO0UyNBKa_l7AEPYbrzRIw/exec';

export const submitToGoogleSheets = async (record: AttendanceRecord): Promise<boolean> => {
  console.log("Sinkronisasi ke Cloud VC...", record.studentName);

  try {
    // Mengirim payload yang sesuai dengan struktur data di skrip Anda
    const payload = {
      id: record.id,
      studentName: record.studentName,
      paket: record.paket,
      kelas: record.kelas,
      keterangan: record.keterangan,
      timestamp: record.timestamp,
      latitude: record.latitude,
      longitude: record.longitude,
      address: record.address,
      imageUrl: record.imageUrl // Skrip Anda akan melakukan decode base64 dari ini
    };

    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors', // Penting untuk bypass CORS pada Google Apps Script
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    // Pada mode no-cors, kita tidak bisa membaca response body, 
    // namun jika fetch selesai tanpa error network, data dianggap terkirim.
    return true;
  } catch (error) {
    console.error("Gagal sinkronisasi cloud:", error);
    return false;
  }
};
