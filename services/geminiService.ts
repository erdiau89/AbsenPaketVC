
import { GoogleGenAI } from "@google/genai";
import { PaketLevel } from "../types";

export const getMotivationalMessage = async (
  name: string, 
  paket: PaketLevel | '', 
  kelas: string, 
  keterangan: string
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Berikan satu kalimat motivasi belajar yang sangat singkat, modern, dan keren untuk siswa bernama ${name} dari ${paket} ${kelas}. Dia baru saja melakukan absensi dengan keterangan: ${keterangan || 'Hadir'}. Gunakan bahasa Indonesia yang santai tapi membakar semangat. Jangan pakai kutipan tokoh, buat yang orisinal. Maksimal 15 kata.`,
      config: {
        temperature: 0.9,
      }
    });

    return response.text || "Teruslah bersinar, masa depan ada di tanganmu!";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Sukses selalu untuk belajarmu hari ini!";
  }
};
