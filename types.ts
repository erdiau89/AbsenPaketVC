
export enum PaketLevel {
  PAKET_A = 'Paket A',
  PAKET_B = 'Paket B',
  PAKET_C = 'Paket C',
  UMUM = 'UMUM'
}

export interface AttendanceRecord {
  id: string;
  studentName: string;
  paket: PaketLevel;
  kelas: string;
  keterangan: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  address: string;
  imageUrl: string;
  synced?: boolean;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  address?: string;
}

export const PAKET_STRUCTURE = {
  [PaketLevel.PAKET_A]: ['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6'],
  [PaketLevel.PAKET_B]: ['Kelas 7', 'Kelas 8', 'Kelas 9'],
  [PaketLevel.PAKET_C]: ['Kelas 10', 'Kelas 11', 'Kelas 12'],
  [PaketLevel.UMUM]: ['Guru', 'Ujian', 'Pengawas', 'Dokumentasi', 'Lainnya'],
};
