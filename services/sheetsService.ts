
import { AttendanceRecord } from '../types';

/**
 * Endpoint Cloud Server untuk centervarian@gmail.com
 * URL ini akan menerima data presensi, koordinat, dan foto (base64).
 */
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzL8zdYj-Y4xSJoAyYvbOpEe3cpXEE86Fy2fetlByHIlYZTe50fFJ_whxJ7gXQJjqETRg/exec';

export const submitToGoogleSheets = async (record: AttendanceRecord): Promise<boolean> => {
  console.log("Sinkronisasi ke centervarian@gmail.com...", record.studentName);

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors', // Penting agar tidak terblokir CORS saat memanggil Apps Script dari browser
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(record),
    });

    // Pada mode 'no-cors', kita tidak bisa mendapatkan status response secara detail (selalu 0),
    // namun jika tidak masuk ke blok catch, diasumsikan request telah terkirim ke server Google.
    return true;
  } catch (error) {
    console.error("Cloud Sync Error:", error);
    return false;
  }
};
