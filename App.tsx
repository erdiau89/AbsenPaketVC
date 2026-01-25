
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PaketLevel, PAKET_STRUCTURE, AttendanceRecord, LocationData } from './types';
import CameraCapture from './components/CameraCapture';
import { submitToGoogleSheets } from './services/sheetsService';
import { getMotivationalMessage } from './services/geminiService';
import { 
  saveRecordLocally, 
  getAllRecordsLocally, 
  clearAllRecordsLocally,
  deleteRecordLocally,
  saveProfile,
  getProfile
} from './services/storageService';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'history'>('attendance');
  const [studentName, setStudentName] = useState('');
  const [selectedPaket, setSelectedPaket] = useState<PaketLevel | ''>('');
  const [selectedKelas, setSelectedKelas] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [location, setLocation] = useState<LocationData | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [motivationalQuote, setMotivationalQuote] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [gpsError, setGpsError] = useState(false);
  
  // State untuk PWA Install
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    const profile = getProfile();
    if (profile) {
      setStudentName(profile.name);
      setSelectedPaket(profile.paket as PaketLevel);
      setSelectedKelas(profile.kelas);
    }
    loadHistory();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    // Listener untuk menangkap ajakan instal aplikasi
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    });

    // Sembunyikan tombol jika aplikasi sudah terpasang
    window.addEventListener('appinstalled', () => {
      setShowInstallBtn(false);
      setDeferredPrompt(null);
    });

    return () => clearInterval(timer);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBtn(false);
    }
    setDeferredPrompt(null);
  };

  useEffect(() => {
    if (studentName || selectedPaket || selectedKelas) {
      saveProfile({ name: studentName, paket: selectedPaket, kelas: selectedKelas });
    }
  }, [studentName, selectedPaket, selectedKelas]);

  const loadHistory = async () => {
    try {
      const records = await getAllRecordsLocally();
      setAttendanceHistory(records);
    } catch (e) {
      console.error("Local DB Error:", e);
    }
  };

  const fetchLocationName = async (lat: number, lon: number): Promise<string> => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`, {
        headers: { 'Accept-Language': 'id' }
      });
      const data = await response.json();
      return data.display_name || "Lokasi Berhasil Terdeteksi";
    } catch (e) {
      console.error("Geocoder Error:", e);
      return "Sinyal GPS Terverifikasi";
    }
  };

  const fetchLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError(true);
      return;
    }
    setGpsError(false);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const addr = await fetchLocationName(latitude, longitude);
        setLocation({
          latitude,
          longitude,
          accuracy,
          address: addr
        });
      },
      (err) => {
        setGpsError(true);
        setLocation({
          latitude: -7.4727,
          longitude: 112.7483,
          accuracy: 0,
          address: "Gunakan data GPS Terakhir / Manual"
        });
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }, []);

  useEffect(() => { fetchLocation(); }, [fetchLocation]);

  const handleSubmit = async () => {
    if (!studentName || !selectedPaket || !selectedKelas || !capturedImage) return;

    setIsSubmitting(true);
    try {
      const record: AttendanceRecord = {
        id: `REC-${Date.now()}`,
        studentName: studentName.trim(),
        paket: selectedPaket as PaketLevel,
        kelas: selectedKelas,
        keterangan: keterangan || 'HADIR',
        timestamp: currentTime.toLocaleString('id-ID', { 
          day: '2-digit', month: 'short', year: 'numeric', 
          hour: '2-digit', minute: '2-digit' 
        }),
        latitude: location?.latitude || 0,
        longitude: location?.longitude || 0,
        address: location?.address || 'KOORDINAT_GPS',
        imageUrl: capturedImage,
        synced: false
      };

      await saveRecordLocally(record);
      const success = await submitToGoogleSheets(record);
      if (success) {
        record.synced = true;
        await saveRecordLocally(record);
      }

      const quote = await getMotivationalMessage(studentName, selectedPaket, selectedKelas, keterangan);
      setMotivationalQuote(quote);
      await loadHistory();
      setSubmitted(true);
    } catch (err) {
      console.error("Submit error:", err);
      alert("Terjadi masalah jaringan. Data disimpan di riwayat lokal.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formProgress = useMemo(() => {
    let p = 0;
    if (studentName) p += 25;
    if (selectedPaket) p += 25;
    if (selectedKelas) p += 25;
    if (capturedImage) p += 25;
    return p;
  }, [studentName, selectedPaket, selectedKelas, capturedImage]);

  const isFormIncomplete = !studentName || !selectedPaket || !selectedKelas;

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="glass-morphism p-10 rounded-[3rem] w-full max-w-sm text-center space-y-8 animate-in zoom-in duration-500">
          <div className="mx-auto w-24 h-24 bg-indigo-600 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.5)]">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black italic tracking-tighter text-white uppercase">Selesai</h2>
            <p className="text-cyan-400 font-bold uppercase tracking-widest text-[10px]">Sinkronisasi Cloud Berhasil</p>
          </div>
          <div className="p-6 bg-indigo-500/5 rounded-3xl border border-white/5 text-sm leading-relaxed italic text-indigo-100/70">
            "{motivationalQuote}"
          </div>
          <button
            onClick={() => { setSubmitted(false); setCapturedImage(null); setActiveTab('history'); }}
            className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl active:scale-95"
          >
            LIHAT LOG HARIAN
          </button>
        </div>
      </div>
    );
  }

  if (isCameraOpen) {
    return (
      <CameraCapture 
        onCapture={(img) => { setCapturedImage(img); setIsCameraOpen(false); }}
        onClose={() => setIsCameraOpen(false)}
        timeLabel={currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })}
        dateLabel={currentTime.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}
        dayLabel={currentTime.toLocaleDateString('id-ID', { weekday: 'long' })}
        locationLabel={location?.address || 'Mencari Lokasi...'}
        gpsCode={`${location?.latitude.toFixed(6) || '-7.47'}, ${location?.longitude.toFixed(6) || '112.74'}`}
        shiftLabel={selectedPaket || "PRESENSI"}
        keteranganLabel={keterangan || "HADIR"}
        studentName={studentName || "SISWA"}
        selectedKelas={selectedKelas || "KELAS"}
      />
    );
  }

  const greeting = useMemo(() => {
    const hour = currentTime.getHours();
    if (hour < 11) return { text: "Selamat Pagi", icon: "☀️", color: "from-indigo-400 to-cyan-400" };
    if (hour < 15) return { text: "Selamat Siang", icon: "🌤️", color: "from-cyan-400 to-blue-500" };
    if (hour < 18) return { text: "Selamat Sore", icon: "🌇", color: "from-orange-400 to-rose-500" };
    return { text: "Selamat Malam", icon: "🌙", color: "from-slate-400 to-indigo-600" };
  }, [currentTime]);

  return (
    <div className="max-w-md mx-auto min-h-screen px-6 py-10 flex flex-col">
      <div className="flex justify-between items-end mb-10">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">ERDI DIGITAL SYSTEMS</p>
          <h1 className={`text-2xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r ${greeting.color}`}>
            {greeting.text} {greeting.icon}
          </h1>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black tracking-tighter mono text-white/90">
            {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })}
          </p>
          <div className="flex items-center justify-end space-x-2">
            <div className={`w-1.5 h-1.5 rounded-full ${location ? 'bg-cyan-400' : 'bg-red-500'} animate-pulse`}></div>
            <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest mono">GPS_SYNC</p>
          </div>
        </div>
      </div>

      <div className="flex p-1 bg-white/5 backdrop-blur-2xl rounded-2xl border border-white/5 mb-10">
        <button onClick={() => setActiveTab('attendance')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'attendance' ? 'bg-white/10 text-white' : 'text-white/30'}`}>PRESENSI</button>
        <button onClick={() => setActiveTab('history')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-white/10 text-white' : 'text-white/30'}`}>RIWAYAT</button>
      </div>

      {activeTab === 'attendance' ? (
        <div className="flex-1 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32">
          
          {/* Tombol Instal Aplikasi (Hanya muncul jika belum terpasang) */}
          {showInstallBtn && (
            <div className="glass-morphism p-4 rounded-3xl border border-indigo-500/30 flex items-center justify-between mb-4">
               <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
                     <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path></svg>
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-white leading-none">Pasang Aplikasi</p>
                    <p className="text-[9px] text-white/40 mt-1">Akses lebih cepat & stabil</p>
                  </div>
               </div>
               <button onClick={handleInstallClick} className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider rounded-xl active:scale-95 transition-transform">INSTAL</button>
            </div>
          )}

          <div className="space-y-2">
             <div className="flex justify-between items-center px-1">
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Kesiapan Berkas</span>
                <span className="text-[9px] font-black text-cyan-400 mono">{formProgress}%</span>
             </div>
             <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 transition-all duration-1000" style={{ width: `${formProgress}%` }}></div>
             </div>
          </div>

          <div className="neo-card p-6 space-y-6">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1">Identitas Lengkap</label>
              <input type="text" value={studentName} onChange={(e) => setStudentName(e.target.value.toUpperCase())} placeholder="NAMA LENGKAP" className="w-full px-5 py-4 bg-white/5 border border-white/5 rounded-2xl outline-none font-bold text-sm text-white focus:border-indigo-500 transition-colors" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1">Pilih Paket</label>
                <select value={selectedPaket} onChange={(e) => { setSelectedPaket(e.target.value as PaketLevel); setSelectedKelas(''); }} className="w-full px-4 py-4 bg-white/5 border border-white/5 rounded-2xl outline-none font-bold text-xs text-white appearance-none">
                  <option value="" className="bg-slate-900">PILIH</option>
                  {Object.values(PaketLevel).map(p => <option key={p} value={p} className="bg-slate-900">{p}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1">Pilih Kelas</label>
                <select value={selectedKelas} onChange={(e) => setSelectedKelas(e.target.value)} disabled={!selectedPaket} className="w-full px-4 py-4 bg-white/5 border border-white/5 rounded-2xl outline-none font-bold text-xs text-white appearance-none">
                  <option value="" className="bg-slate-900">KELAS</option>
                  {selectedPaket && PAKET_STRUCTURE[selectedPaket as PaketLevel].map(k => <option key={k} value={k} className="bg-slate-900">{k}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1">Catatan</label>
              <input type="text" value={keterangan} onChange={(e) => setKeterangan(e.target.value.toUpperCase())} placeholder="KETERANGAN" className="w-full px-5 py-4 bg-white/5 border border-white/5 rounded-2xl outline-none font-medium text-xs text-white" />
            </div>
          </div>

          <div className="flex flex-col items-center justify-center space-y-6">
            {capturedImage ? (
              <div className="relative w-full aspect-square max-w-[280px]">
                <div className="relative h-full w-full rounded-[2rem] overflow-hidden border border-white/20 shadow-2xl">
                  <img src={capturedImage} alt="Preview" className="w-full h-full object-cover" />
                  <button onClick={() => setCapturedImage(null)} className="absolute top-4 right-4 p-3 bg-red-500 text-white rounded-full"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"></path></svg></button>
                </div>
              </div>
            ) : (
              <button onClick={() => isFormIncomplete ? alert("Lengkapi profil!") : setIsCameraOpen(true)} className={`w-36 h-36 rounded-full flex flex-col items-center justify-center transition-all ${isFormIncomplete ? 'bg-white/5 opacity-50' : 'bg-indigo-600 pulse-cyan'}`}>
                <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                <span className="text-[8px] font-black uppercase tracking-widest mt-3 text-white">AMBIL FOTO</span>
              </button>
            )}
          </div>

          <div className="fixed bottom-10 left-0 right-0 z-50 flex justify-center px-10">
            <button onClick={handleSubmit} disabled={formProgress < 100 || isSubmitting} className={`w-full max-w-xs py-5 rounded-3xl font-black text-xs uppercase tracking-[0.4em] transition-all ${formProgress === 100 ? 'bg-indigo-600 text-white shadow-xl shimmer-effect' : 'bg-white/5 text-white/10'}`}>
              {isSubmitting ? 'MENYIMPAN...' : 'KIRIM DATA'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-6 overflow-y-auto hide-scrollbar pb-32">
          {attendanceHistory.length === 0 ? (
             <div className="py-20 text-center opacity-20"><p className="text-[10px] font-black uppercase tracking-widest">Belum ada riwayat</p></div>
          ) : (
            attendanceHistory.map((item) => (
              <div key={item.id} onClick={() => setSelectedRecord(item)} className="glass-morphism p-4 rounded-[2rem] flex items-center space-x-4 border border-white/5 active:scale-95 transition-all">
                <img src={item.imageUrl} className="w-16 h-16 rounded-2xl object-cover" alt="H" />
                <div className="flex-1">
                  <h3 className="text-sm font-black text-white uppercase">{item.studentName}</h3>
                  <p className="text-[9px] text-white/40 font-bold">{item.timestamp}</p>
                </div>
                <div className={`w-2 h-2 rounded-full ${item.synced ? 'bg-cyan-400' : 'bg-orange-500'}`}></div>
              </div>
            ))
          )}
        </div>
      )}

      {selectedRecord && (
        <div className="fixed inset-0 z-[100] bg-slate-950/98 backdrop-blur-3xl flex flex-col p-8">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-black text-white italic">DETAIL_ABSENSI</h2>
            <button onClick={() => setSelectedRecord(null)} className="p-4 bg-white/10 rounded-full text-white"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"></path></svg></button>
          </div>
          <div className="flex-1 rounded-[3rem] overflow-hidden border border-white/5">
             <img src={selectedRecord.imageUrl} className="w-full h-full object-cover" alt="Detail" />
          </div>
          <div className="mt-8 space-y-3">
             <p className="text-white text-3xl font-black tracking-tighter">{selectedRecord.studentName}</p>
             <div className="p-5 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[10px] text-white/40 font-bold uppercase mb-2">Lokasi Presensi</p>
                <p className="text-white/80 text-xs font-medium leading-relaxed">{selectedRecord.address}</p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
