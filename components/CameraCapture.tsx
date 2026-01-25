
import React, { useRef, useState, useCallback, useEffect } from 'react';

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  onClose: () => void;
  locationLabel: string;
  timeLabel: string;
  dateLabel: string;
  dayLabel: string;
  gpsCode: string;
  shiftLabel: string;
  keteranganLabel: string;
  studentName: string;
  selectedKelas: string;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ 
  onCapture, 
  onClose,
  locationLabel, 
  timeLabel, 
  dateLabel, 
  dayLabel, 
  gpsCode,
  shiftLabel,
  keteranganLabel,
  studentName,
  selectedKelas
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [timerDuration, setTimerDuration] = useState<0 | 3 | 5 | 10>(0);
  const [countdown, setCountdown] = useState<number | null>(null);

  const startCamera = async () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false 
      });
      setStream(mediaStream);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
      setError(null);
    } catch (err) {
      console.error("Camera error:", err);
      setError("Izin Kamera Ditolak atau Tidak Tersedia.");
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [facingMode]);

  const toggleCamera = () => {
    if (countdown !== null) return;
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const cycleTimer = () => {
    if (countdown !== null) return;
    setTimerDuration(prev => {
      if (prev === 0) return 3;
      if (prev === 3) return 5;
      if (prev === 5) return 10;
      return 0;
    });
  };

  const drawWatermark = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const scale = width / 1080;
    
    // Konfigurasi Bayangan (Shadow) untuk keterbacaan tinggi
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 10 * scale;
    ctx.shadowOffsetX = 3 * scale;
    ctx.shadowOffsetY = 3 * scale;

    // --- OVERLAY GRADIENT (Bawah agar teks putih terlihat jelas) ---
    const grad = ctx.createLinearGradient(0, height, 0, height - 450 * scale);
    grad.addColorStop(0, 'rgba(0,0,0,0.7)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, height - 450 * scale, width, 450 * scale);

    // --- KIRI ATAS: IDENTITAS (SESUAI REFERENSI) ---
    ctx.textAlign = 'left';
    // Baris 1: Nama/Judul (Kuning Terang)
    ctx.fillStyle = '#facc15'; 
    ctx.font = `bold ${36 * scale}px "Plus Jakarta Sans"`;
    ctx.fillText(studentName.toUpperCase(), 60 * scale, 75 * scale);
    
    // Baris 2: Detail (Putih Miring dengan Tanda Kutip)
    ctx.fillStyle = 'white';
    ctx.font = `italic 600 ${24 * scale}px "Plus Jakarta Sans"`;
    ctx.fillText(`"${shiftLabel} - ${selectedKelas}"`, 60 * scale, 110 * scale);

    // --- KANAN ATAS: BRANDING ---
    ctx.textAlign = 'right';
    ctx.font = `bold ${24 * scale}px "Plus Jakarta Sans"`;
    ctx.fillText("E-Absensi Digital ERDI", width - 60 * scale, 70 * scale);
    ctx.font = `500 ${18 * scale}px "Plus Jakarta Sans"`;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText("Foto 100% Akurat", width - 60 * scale, 100 * scale);

    // --- BAGIAN BAWAH: CLUSTER JAM & LOKASI ---
    ctx.textAlign = 'left';
    ctx.fillStyle = 'white';
    
    // 1. JAM (BESAR)
    ctx.font = `bold ${160 * scale}px "Plus Jakarta Sans"`;
    const timeWidth = ctx.measureText(timeLabel).width;
    const clockY = height - 130 * scale;
    ctx.fillText(timeLabel, 60 * scale, clockY);

    // 2. GARIS PEMISAH VERTIKAL (ORANYE)
    const lineX = 60 * scale + timeWidth + 35 * scale;
    ctx.strokeStyle = '#f97316'; // Vivid Orange
    ctx.lineWidth = 6 * scale;
    ctx.beginPath();
    ctx.moveTo(lineX, clockY - 110 * scale);
    ctx.lineTo(lineX, clockY + 5 * scale);
    ctx.stroke();

    // 3. TANGGAL & HARI (DI SAMPING GARIS)
    ctx.fillStyle = 'white';
    ctx.font = `bold ${34 * scale}px "Plus Jakarta Sans"`;
    ctx.fillText(dateLabel, lineX + 30 * scale, clockY - 65 * scale);
    ctx.font = `500 ${34 * scale}px "Plus Jakarta Sans"`;
    ctx.fillText(dayLabel, lineX + 30 * scale, clockY - 15 * scale);

    // 4. ALAMAT LENGKAP (DI BAWAH JAM)
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = `500 ${26 * scale}px "Plus Jakarta Sans"`;
    const address = locationLabel === 'LOKASI_TERVERIFIKASI' ? 'Mencari sinyal GPS...' : locationLabel;
    
    // Logika wrapping teks jika alamat terlalu panjang
    const maxAddrWidth = width - 120 * scale;
    const words = address.split(' ');
    let currentLine = '';
    let addressY = height - 85 * scale;

    for(let n = 0; n < words.length; n++) {
      let testLine = currentLine + words[n] + ' ';
      if (ctx.measureText(testLine).width > maxAddrWidth && n > 0) {
        ctx.fillText(currentLine, 60 * scale, addressY);
        currentLine = words[n] + ' ';
        addressY += 35 * scale;
      } else {
        currentLine = testLine;
      }
    }
    ctx.fillText(currentLine, 60 * scale, addressY);

    // 5. KOORDINAT GPS (HALUS)
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = `500 ${16 * scale}px "JetBrains Mono"`;
    ctx.fillText(`GPS: ${gpsCode}`, 60 * scale, height - 35 * scale);
  };

  const doCapture = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const targetWidth = 1080;
        const aspectRatio = video.videoHeight / video.videoWidth;
        const targetHeight = targetWidth * aspectRatio;

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        if (facingMode === 'user') {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        drawWatermark(ctx, canvas.width, canvas.height);
        onCapture(canvas.toDataURL('image/jpeg', 0.85));
      }
    }
  }, [facingMode, onCapture, timeLabel, dateLabel, dayLabel, locationLabel, gpsCode, studentName, shiftLabel, selectedKelas]);

  const handleCaptureClick = () => {
    if (countdown !== null) return;
    if (timerDuration > 0) {
      setCountdown(timerDuration);
      const interval = setInterval(() => {
        setCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            doCapture();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      doCapture();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col overflow-hidden animate-in fade-in duration-500">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} 
      />
      
      {countdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-[110]">
          <span className="text-white text-[12rem] font-black animate-[ping_1s_infinite] drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]">
            {countdown}
          </span>
        </div>
      )}
      
      {/* HUD UI Elements */}
      <div className="absolute top-10 left-8 right-8 flex justify-between items-start">
        <button onClick={onClose} className="p-4 glass-morphism rounded-full text-white active:scale-90 transition-transform">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <div className="text-right">
          <div className="flex items-center justify-end space-x-2">
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white shadow-sm">Kamera Aktif</p>
          </div>
          <p className="text-white/40 text-[9px] mono mt-1">SECURE_AUTH_4.0</p>
        </div>
      </div>

      <div className="absolute bottom-12 left-0 right-0 flex justify-between items-center px-12">
        <button 
          onClick={toggleCamera} 
          className="w-14 h-14 glass-morphism rounded-full text-white flex items-center justify-center active:scale-90 transition-all border border-white/10"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path>
          </svg>
        </button>
        
        <button
          onClick={handleCaptureClick}
          className="w-24 h-24 bg-white rounded-full flex items-center justify-center p-1.5 shadow-[0_0_40px_rgba(255,255,255,0.4)] active:scale-95 transition-transform"
        >
          <div className="w-full h-full border-[6px] border-slate-200 rounded-full bg-white flex items-center justify-center">
            {countdown ? (
               <span className="text-slate-900 font-black text-2xl mono">{countdown}</span>
            ) : (
               <div className="w-1/2 h-1/2 bg-indigo-600 rounded-full shadow-inner"></div>
            )}
          </div>
        </button>

        <button 
          onClick={cycleTimer}
          className={`w-14 h-14 glass-morphism rounded-full flex flex-col items-center justify-center active:scale-90 transition-all border ${timerDuration > 0 ? 'border-yellow-400 text-yellow-400' : 'border-white/10 text-white'}`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path>
          </svg>
          {timerDuration > 0 && <span className="text-[10px] font-black absolute mt-8">{timerDuration}s</span>}
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/98 p-12 text-center z-[200]">
          <div className="space-y-6">
            <p className="text-white text-lg font-black tracking-tight">{error}</p>
            <button onClick={onClose} className="px-10 py-4 bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest rounded-2xl">Batal</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraCapture;
