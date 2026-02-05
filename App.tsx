
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
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [motivationalQuote, setMotivationalQuote] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [gpsError, setGpsError] = useState(false);
  
  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const profile = getProfile();
    if (profile) {
      setStudentName(profile.name);
      setSelectedPaket(profile.paket as PaketLevel);
      setSelectedKelas(profile.kelas);
    }
    loadHistory();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    // PWA Install Prompt Listener
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    });

    window.addEventListener('appinstalled', () => {
      setShowInstallBanner(false);
      setDeferredPrompt(null);
      console.log('PWA Installed successfully');
    });

    return () => clearInterval(timer);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
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

  const exportToCSV = () => {
    if (attendanceHistory.length === 0) return;
    
    const headers = ['ID', 'Nama', 'Paket', 'Kelas', 'Keterangan', 'Waktu', 'Latitude', 'Longitude', 'Alamat'];
    const rows = attendanceHistory.map(record => [
      record.id,
      record.studentName,
      record.paket,
      record.kelas,
      record.keterangan,
      record.timestamp,
      record.latitude,
      record.longitude,
      record.address
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ERDI_Attendance_Log_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadImage = (imageUrl: string, name: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `ERDI_VER_${name}_${Date.now()}.jpg`;
    link.click();
  };

  const handleDeleteRecord = async (id: string) => {
    if (window.confirm("Hapus log ini secara permanen?")) {
      await deleteRecordLocally(id);
      if (selectedRecord?.id === id) setSelectedRecord(null);
      await loadHistory();
    }
  };

  const greeting = useMemo(() => {
    const hour = currentTime.getHours();
    if (hour < 11) return { text: "Selamat Pagi", icon: "☀️", color: "from-indigo-400 to-cyan-400" };
    if (hour < 15) return { text: "Selamat Siang", icon: "🌤️", color: "from-cyan-400 to-blue-500" };
    if (hour < 18) return { text: "Selamat Sore", icon: "🌇", color: "from-orange-400 to-rose-500" };
    return { text: "Selamat Malam", icon: "🌙", color: "from-slate-400 to-indigo-600" };
  }, [currentTime]);

  const fetchAddressFromCoords = async (lat: number, lon: number) => {
    setIsFetchingAddress(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`, {
        headers: { 'Accept-Language': 'id' }
      });
      const data = await response.json();
      const address = data.display_name || "ALAMAT_TIDAK_TERDETEKSI";
      return address;
    } catch (error) {
      console.error("Geocoding Error:", error);
      return "LOKASI_TERVERIFIKASI (GPS_ONLY)";
    } finally {
      setIsFetchingAddress(false);
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
        setLocation({
          latitude,
          longitude,
          accuracy,
          address: "Mencari Alamat..."
        });

        const fullAddress = await fetchAddressFromCoords(latitude, longitude);
        setLocation(prev => prev ? { ...prev, address: fullAddress } : null);
      },
      (err) => {
        console.warn("GPS Fail:", err);
        setGpsError(true);
        setLocation({
          latitude: -7.4727,
          longitude: 112.7483,
          accuracy: 0,
          address: "LOKASI_DEFAULT_OFFLINE"
        });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  useEffect(() => { fetchLocation(); }, [fetchLocation]);

  const handleSubmit = async () => {
    if (!studentName || !selectedPaket || !selectedKelas || !capturedImage) return;

    setIsSubmitting(true);
    try {
      const recordId = `REC-${Date.now()}`;
      const record: AttendanceRecord = {
        id: recordId,
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
      alert("Terjadi kesalahan sistem. Riwayat tersimpan secara lokal.");
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
  const isReadyToSubmit = !isSubmitting && formProgress === 100;

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
            <h2 className="text-3xl font-black italic tracking-tighter text-white">VERIFIED</h2>
            <p className="text-cyan-400 font-bold uppercase tracking-widest text-[10px]">Absensi Anda Berhasil Dicatat</p>
          </div>
          <div className="p-6 bg-indigo-500/5 rounded-3xl border border-white/5 text-sm leading-relaxed italic text-indigo-100/70">
            "{motivationalQuote}"
          </div>
          <button
            onClick={() => { setSubmitted(false); setCapturedImage(null); setActiveTab('history'); }}
            className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-500 transition-all active:scale-95"
          >
            LIHAT LOG
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
        locationLabel={location?.address || 'LOKASI_GPS'}
        gpsCode={`${location?.latitude.toFixed(6) || '-7.47'}, ${location?.longitude.toFixed(6) || '112.74'}`}
        shiftLabel={selectedPaket || "NOT_SET"}
        keteranganLabel={keterangan || "HADIR"}
        studentName={studentName || "PENGGUNA"}
        selectedKelas={selectedKelas || "N/A"}
      />
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen px-6 py-10 flex flex-col">
      {/* Premium Header */}
      <div className="flex justify-between items-end mb-10">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">ERDI DIGITAL SYSTEMS</p>
          <h1 className={`text-2xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r ${greeting.color}`}>
            {greeting.text} {greeting.icon}
          </h1>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mono -mb-1">
            {currentTime.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
          <p className="text-3xl font-black tracking-tighter mono text-white/90">
            {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })}
          </p>
          <div className="flex items-center justify-end space-x-2">
            <div className={`w-1.5 h-1.5 rounded-full ${location && !gpsError && !isFetchingAddress ? 'bg-cyan-400' : 'bg-orange-500'} animate-pulse`}></div>
            <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest mono">
              {isFetchingAddress ? 'GEO_FETCHING' : 'GPS_LINKED'}
            </p>
          </div>
        </div>
      </div>

      {/* Modern Tabs */}
      <div className="flex p-1 bg-white/5 backdrop-blur-2xl rounded-2xl border border-white/5 mb-8 overflow-hidden">
        <button 
          onClick={() => setActiveTab('attendance')}
          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'attendance' ? 'bg-white/10 text-white shadow-lg' : 'text-white/30 hover:text-white/50'}`}
        >
          PRESENSI
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'history' ? 'bg-white/10 text-white shadow-lg' : 'text-white/30 hover:text-white/50'}`}
        >
          RIWAYAT
        </button>
      </div>

      {activeTab === 'attendance' ? (
        <div className="flex-1 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32">
          
          {/* PWA Install Banner */}
          {showInstallBanner && (
            <div className="glass-morphism p-4 rounded-3xl border border-indigo-500/30 bg-indigo-500/5 flex items-center justify-between animate-bounce-subtle">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-500 rounded-xl">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path></svg>
                </div>
                <div>
                  <p className="text-[10px] font-black text-white uppercase tracking-wider">Akses Lebih Cepat</p>
                  <p className="text-[9px] font-bold text-indigo-300 uppercase">Pasang di Layar Utama</p>
                </div>
              </div>
              <button 
                onClick={handleInstallClick}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
              >
                INSTAL
              </button>
            </div>
          )}

          {/* Real-time Location Info Card */}
          <div className="glass-morphism p-5 rounded-3xl border border-cyan-500/10 shadow-[0_0_30px_rgba(34,211,238,0.05)]">
             <div className="flex justify-between items-start mb-3">
                <div className="flex items-center space-x-2">
                   <div className="p-2 bg-cyan-500/10 rounded-xl">
                      <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path></svg>
                   </div>
                   <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">LOKASI SEKARANG</span>
                </div>
                <button 
                  onClick={() => { setLocation(null); fetchLocation(); }}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors active:scale-90"
                  title="Update Lokasi"
                >
                  <svg className={`w-3.5 h-3.5 text-white/30 ${isFetchingAddress ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"></path></svg>
                </button>
             </div>
             <p className={`text-xs font-bold leading-relaxed ${location?.address ? 'text-white/80' : 'text-white/20 italic'}`}>
                {location?.address || "Menghubungkan Satelit..."}
             </p>
             {location && (
               <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[8px] font-bold text-white/20 mono uppercase tracking-widest">COORDS: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</span>
                  <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">verified_area</span>
               </div>
             )}
          </div>

          {/* Progress Indicator */}
          <div className="space-y-2">
             <div className="flex justify-between items-center px-1">
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Kesiapan Berkas</span>
                <span className="text-[9px] font-black text-cyan-400 mono">{formProgress}%</span>
             </div>
             <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(99,102,241,0.5)]" style={{ width: `${formProgress}%` }}></div>
             </div>
          </div>

          <div className="neo-card p-6 space-y-6">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1">Identitas Lengkap</label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value.toUpperCase())}
                placeholder="NAMA LENGKAP ANDA"
                className="w-full px-5 py-4 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-indigo-500 transition-all font-bold text-sm tracking-tight text-white placeholder:text-white/10"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1">Pilih Level</label>
                <div className="relative">
                  <select
                    value={selectedPaket}
                    onChange={(e) => { setSelectedPaket(e.target.value as PaketLevel); setSelectedKelas(''); }}
                    className="w-full px-4 py-4 bg-white/5 border border-white/5 rounded-2xl outline-none font-bold text-xs text-white appearance-none cursor-pointer focus:border-indigo-500"
                  >
                    <option value="" className="bg-slate-900">LEVEL</option>
                    {Object.values(PaketLevel).map(p => <option key={p} value={p} className="bg-slate-900">{p}</option>)}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-20">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"></path></svg>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1">Sub Level</label>
                <div className="relative">
                  <select
                    value={selectedKelas}
                    onChange={(e) => setSelectedKelas(e.target.value)}
                    disabled={!selectedPaket}
                    className="w-full px-4 py-4 bg-white/5 border border-white/5 rounded-2xl outline-none font-bold text-xs text-white appearance-none disabled:opacity-10 cursor-pointer focus:border-indigo-500"
                  >
                    <option value="" className="bg-slate-900">KELAS</option>
                    {selectedPaket && PAKET_STRUCTURE[selectedPaket as PaketLevel].map(k => <option key={k} value={k} className="bg-slate-900">{k}</option>)}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-20">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"></path></svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1">Catatan Tambahan</label>
              <input
                type="text"
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value.toUpperCase())}
                placeholder="DARING / LURING / HADIR"
                className="w-full px-5 py-4 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-indigo-500 transition-all font-medium text-xs text-white placeholder:text-white/10"
              />
            </div>
          </div>

          {/* Action Area */}
          <div className="flex flex-col items-center justify-center space-y-6">
            {capturedImage ? (
              <div className="relative w-full aspect-square max-w-[280px] group animate-in zoom-in-95 duration-500">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                <div className="relative h-full w-full rounded-[2rem] overflow-hidden border border-white/20 shadow-2xl">
                  <img src={capturedImage} alt="Selfie Verification" className="w-full h-full object-cover" />
                  <button 
                    onClick={() => setCapturedImage(null)} 
                    className="absolute top-4 right-4 p-3 bg-red-500 text-white rounded-full shadow-lg active:scale-90 transition-transform"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"></path></svg>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-4">
                <button 
                  onClick={() => isFormIncomplete ? alert("Mohon lengkapi profil Anda terlebih dahulu.") : setIsCameraOpen(true)}
                  className={`w-36 h-36 rounded-full flex flex-col items-center justify-center transition-all duration-500 group relative ${isFormIncomplete ? 'bg-white/5 border border-white/5' : 'bg-indigo-600 shadow-[0_0_50px_rgba(99,102,241,0.3)] pulse-cyan'}`}
                >
                  <svg className={`w-14 h-14 transition-transform duration-500 ${isFormIncomplete ? 'text-white/10' : 'text-white group-hover:scale-110'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                  </svg>
                  <span className={`text-[8px] font-black uppercase tracking-[0.2em] mt-3 ${isFormIncomplete ? 'text-white/10' : 'text-white/70'}`}>Mulai Verifikasi</span>
                </button>
                {isFormIncomplete && <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Lengkapi Data Profil</p>}
              </div>
            )}
          </div>

          {/* Floating Submit Button */}
          <div className="fixed bottom-10 left-0 right-0 z-50 flex justify-center px-10">
            <button
              onClick={handleSubmit}
              disabled={!isReadyToSubmit}
              className={`
                relative w-full max-w-xs py-5 rounded-3xl font-black text-xs uppercase tracking-[0.4em] transition-all duration-500 transform active:scale-95 flex items-center justify-center overflow-hidden
                ${isReadyToSubmit 
                  ? 'bg-indigo-600 text-white shadow-[0_20px_40px_rgba(99,102,241,0.3)] shimmer-effect' 
                  : 'bg-white/5 text-white/10 border border-white/5 cursor-not-allowed'}
              `}
            >
              {isSubmitting ? (
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  <span className="animate-pulse italic">MEMPROSES...</span>
                </div>
              ) : (
                <span className="drop-shadow-lg">KIRIM ABSENSI</span>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto hide-scrollbar pb-32">
          {/* History Header */}
          <div className="flex justify-between items-center px-2">
            <div>
              <h2 className="text-xl font-black text-white italic tracking-tighter">History Log</h2>
              <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.2em] mono">STORAGE_DEVICE_LOCAL</p>
            </div>
            <div className="flex items-center space-x-3">
              <button onClick={exportToCSV} className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all shadow-lg active:scale-90">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path></svg>
              </button>
              <button 
                onClick={() => { if(window.confirm("RESET SEMUA LOG?")) clearAllRecordsLocally().then(() => setAttendanceHistory([])) }} 
                className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 hover:bg-rose-500 hover:text-white transition-all shadow-lg active:scale-90"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path></svg>
              </button>
            </div>
          </div>

          {attendanceHistory.length === 0 ? (
            <div className="h-80 flex flex-col items-center justify-center space-y-4">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center border border-white/5">
                <svg className="w-8 h-8 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
              </div>
              <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">No data available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {attendanceHistory.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => setSelectedRecord(item)}
                  className="glass-morphism p-4 rounded-[2.5rem] flex items-center space-x-4 border border-white/5 hover:border-indigo-500/30 active:scale-[0.98] transition-all cursor-pointer group relative overflow-hidden"
                >
                  <div className="w-16 h-16 rounded-[1.5rem] overflow-hidden bg-slate-800 flex-shrink-0 border border-white/10 shadow-lg relative">
                    <img src={item.imageUrl} alt="Log" className="w-full h-full object-cover" />
                    {item.synced && <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-cyan-400 rounded-full border-2 border-slate-900 shadow-sm"></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className="text-sm font-black text-white truncate group-hover:text-indigo-400 transition-colors uppercase">{item.studentName}</h3>
                      <span className="text-[9px] font-black text-white/30 mono">{item.timestamp.split(',')[1]}</span>
                    </div>
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-tighter mt-0.5">{item.paket} • {item.kelas}</p>
                    
                    {/* Quick Actions at Card Level */}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center space-x-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${item.synced ? 'bg-cyan-400' : 'bg-orange-500'}`}></div>
                        <span className={`text-[8px] font-black uppercase tracking-widest ${item.synced ? 'text-cyan-400/60' : 'text-orange-500/60'}`}>
                          {item.synced ? 'SYNC_OK' : 'PENDING'}
                        </span>
                      </div>
                      <div className="flex space-x-2">
                         <button 
                            onClick={(e) => { e.stopPropagation(); downloadImage(item.imageUrl, item.studentName); }}
                            className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg hover:bg-indigo-500 hover:text-white transition-all shadow-sm"
                         >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"></path></svg>
                         </button>
                         <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteRecord(item.id); }}
                            className="p-2 bg-rose-500/10 text-rose-400 rounded-lg hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                         >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"></path></svg>
                         </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-3xl flex flex-col animate-in fade-in zoom-in-95 duration-300">
          <div className="flex justify-between items-center p-8 shrink-0">
            <div className="space-y-1">
              <h2 className="text-2xl font-black italic tracking-tighter text-white">LOG_DETAILS</h2>
              <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mono">{selectedRecord.id}</p>
            </div>
            <button onClick={() => setSelectedRecord(null)} className="p-4 glass-morphism rounded-full text-white active:scale-90 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"></path></svg>
            </button>
          </div>
          
          <div className="flex-1 px-8 overflow-y-auto hide-scrollbar space-y-8 pb-32">
            <div className="neo-card overflow-hidden border border-white/10 shadow-2xl relative group bg-slate-900">
              <img src={selectedRecord.imageUrl} className="w-full h-auto" alt="Verified Presence" />
              <div className="p-8 space-y-4 bg-gradient-to-t from-slate-950 to-slate-900/50">
                 <div className="space-y-1">
                    <p className="text-white text-3xl font-black tracking-tighter uppercase leading-none">{selectedRecord.studentName}</p>
                    <p className="text-cyan-400 text-sm font-bold tracking-widest uppercase">{selectedRecord.paket} • {selectedRecord.kelas}</p>
                 </div>
                 <div className="space-y-3 pt-4 border-t border-white/10">
                    <div className="flex items-center space-x-2 text-[10px] font-bold text-white/50 mono">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path></svg>
                      <span>{selectedRecord.timestamp}</span>
                    </div>
                    <div className="flex items-start space-x-2 text-[10px] font-bold text-white/70 leading-relaxed">
                      <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path></svg>
                      <span>{selectedRecord.address}</span>
                    </div>
                 </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <button 
                  onClick={() => downloadImage(selectedRecord.imageUrl, selectedRecord.studentName)}
                  className="py-6 bg-indigo-600 rounded-[2.2rem] font-black text-[11px] uppercase tracking-widest text-white shadow-[0_15px_30px_rgba(99,102,241,0.4)] flex items-center justify-center space-x-3 active:scale-95 transition-all"
               >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"></path></svg>
                  <span>DOWNLOAD</span>
               </button>
               <button 
                  onClick={() => handleDeleteRecord(selectedRecord.id)}
                  className="py-6 bg-rose-500/10 border border-rose-500/30 text-rose-500 rounded-[2.2rem] font-black text-[11px] uppercase tracking-widest flex items-center justify-center space-x-3 active:bg-rose-500 active:text-white transition-all shadow-lg"
               >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"></path></svg>
                  <span>HAPUS</span>
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
