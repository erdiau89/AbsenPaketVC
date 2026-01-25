
import { AttendanceRecord } from '../types';

const STORAGE_KEY = 'erdi_attendance_v1';
const PROFILE_KEY = 'erdi_profile_v1';

export interface UserProfile {
  name: string;
  paket: string;
  kelas: string;
}

export const saveRecordLocally = async (record: AttendanceRecord): Promise<void> => {
  const existing = await getAllRecordsLocally();
  const index = existing.findIndex(r => r.id === record.id);
  
  if (index >= 0) {
    existing[index] = record;
  } else {
    existing.unshift(record);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
};

export const getAllRecordsLocally = async (): Promise<AttendanceRecord[]> => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const deleteRecordLocally = async (id: string): Promise<void> => {
  const existing = await getAllRecordsLocally();
  const filtered = existing.filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
};

export const clearAllRecordsLocally = async (): Promise<void> => {
  localStorage.removeItem(STORAGE_KEY);
};

export const saveProfile = (profile: UserProfile): void => {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
};

export const getProfile = (): UserProfile | null => {
  const data = localStorage.getItem(PROFILE_KEY);
  return data ? JSON.parse(data) : null;
};
