
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
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState("Menyiapkan Hardware...");
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [timerDuration, setTimerDuration] = useState<0 | 3 | 5 | 10>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showForceButton, setShowForceButton] = useState(false);

  const stopExistingStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startCamera = async () => {
    setIsCameraReady(false);
    setCameraError(null);
    setShowForceButton(false);
    setLoadingStatus("Meminta Akses Kamera...");

    stopExistingStream();

    try {
      const constraints = {
        video: { 
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false 
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;
      setLoadingStatus("Menghubungkan Sinyal...");
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        setTimeout(() => {
          if (!isCameraReady) setShowForceButton(true);
        }, 4000);
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      let msg = "Akses Kamera Bermasalah";
      if (err.name === 'NotAllowedError') msg = "Izin Kamera Diblokir Browser";
      if (err.name === 'NotFoundError') msg = "Kamera Tidak Terdeteksi";
      if (err.name === 'NotReadableError') msg = "Kamera Sedang Digunakan Aplikasi Lain";
      setCameraError(msg);
    }
  };

  const handleVideoCanPlay = () => {
    if (videoRef.current) {
      setLoadingStatus("Sinkronisasi Frame...");
      videoRef.current.play()
        .then(() => {
          setIsCameraReady(true);
          setLoadingStatus("Kamera Aktif");
        })
        .catch(err => {
          console.error("Autoplay blocked by browser:", err);
          setShowForceButton(true);
          setLoadingStatus("Klik Tombol untuk Memulai");
        });
    }
  };

  useEffect(() => {
    startCamera();
    return () => stopExistingStream();
  }, [facingMode]);

  const forcePlay = () => {
    if (videoRef.current) {
      videoRef.current.play()
        .then(() => setIsCameraReady(true))
        .catch(console.error);
    }
  };

  const drawWatermark = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const scale = width / 800;
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 10 * scale;
    ctx.shadowOffsetX = 3 * scale;
    ctx.shadowOffsetY = 3 * scale;

    // Overlay gelap di atas dan bawah untuk keterbacaan teks
    const gradBottom = ctx.createLinearGradient(0, height, 0, height - 350 * scale);
    gradBottom.addColorStop(0, 'rgba(0,0,0,0.8)');
    gradBottom.addColorStop(1, 'transparent');
    ctx.fillStyle = gradBottom;
    ctx.fillRect(0, height - 350 * scale, width, 350 * scale);

    const gradTop = ctx.createLinearGradient(0, 0, 0, 200 * scale);
    gradTop.addColorStop(0, 'rgba(0,0,0,0.6)');
    gradTop.addColorStop(1, 'transparent');
    ctx.fillStyle = gradTop;
    ctx.fillRect(0, 0, width, 200 * scale);

    // KIRI ATAS: IDENTITAS (NAMA DIPERBESAR)
    ctx.textAlign = 'left';
    ctx.fillStyle = '#facc15'; // Kuning ERDI
    ctx.font = `bold ${42 * scale}px "Plus Jakarta Sans"`;
    ctx.fillText(studentName.toUpperCase(), 40 * scale, 65 * scale);

    ctx.fillStyle = 'white';
    ctx.font = `italic 600 ${20 * scale}px "Plus Jakarta Sans"`;
    ctx.fillText(`"${shiftLabel} - ${selectedKelas}"`, 40 * scale, 100 * scale);

    // Tambah Keterangan jika ada
    if (keteranganLabel && keteranganLabel !== "HADIR") {
      ctx.fillStyle = '#22d3ee'; // Warna Cyan untuk pembeda
      ctx.font = `bold ${16 * scale}px "Plus Jakarta Sans"`;
      ctx.fillText(`STATUS: ${keteranganLabel.toUpperCase()}`, 40 * scale, 130 * scale);
    }

    // KANAN ATAS: JUDUL APLIKASI + LABEL AKURASI
    ctx.textAlign = 'right';
    ctx.fillStyle = 'white';
    ctx.font = `bold ${18 * scale}px "Plus Jakarta Sans"`;
    ctx.fillText("E-ABSENSI DIGITAL ERDI", width - 40 * scale, 55 * scale);
    
    ctx.font = `italic 500 ${14 * scale}px "Plus Jakarta Sans"`;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText("Foto 100% Akurat", width - 40 * scale, 78 * scale);

    // BAWAH: JAM DIGITAL BESAR
    ctx.textAlign = 'left';
    ctx.fillStyle = 'white';
    ctx.font = `bold ${120 * scale}px "Plus Jakarta Sans"`;
    const timeWidth = ctx.measureText(timeLabel).width;
    const clockY = height - 110 * scale;
    ctx.fillText(timeLabel, 40 * scale, clockY);

    // Garis Pemisah Orange
    const lineX = 40 * scale + timeWidth + 25 * scale;
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 5 * scale;
    ctx.beginPath();
    ctx.moveTo(lineX, clockY - 85 * scale);
    ctx.lineTo(lineX, clockY + 5 * scale);
    ctx.stroke();

    // Tanggal & Hari
    ctx.fillStyle = 'white';
    ctx.font = `bold ${28 * scale}px "Plus Jakarta Sans"`;
    ctx.fillText(dateLabel, lineX + 25 * scale, clockY - 50 * scale);
    ctx.font = `500 ${28 * scale}px "Plus Jakarta Sans"`;
    ctx.fillText(dayLabel, lineX + 25 * scale, clockY - 10 * scale);

    // Alamat Lengkap
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = `500 ${22 * scale}px "Plus Jakarta Sans"`;
    const fullLoc = locationLabel;
    const maxWidth = width - 80 * scale;
    const words = fullLoc.split(' ');
    let currentLine = '';
    let addressY = height - 70 * scale;
    
    for(let n = 0; n < words.length; n++) {
      let testLine = currentLine + words[n] + ' ';
      if (ctx.measureText(testLine).width > maxWidth && n > 0) {
        ctx.fillText(currentLine, 40 * scale, addressY);
        currentLine = words[n] + ' ';
        addressY += 30 * scale;
      } else {
        currentLine = testLine;
      }
    }
    ctx.fillText(currentLine, 40 * scale, addressY);

    // GPS Footer
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = `500 ${12 * scale}px "JetBrains Mono"`;
    ctx.fillText(`GPS: ${gpsCode}`, 40 * scale, height - 25 * scale);
  };

  const doCapture = useCallback(() => {
    if (videoRef.current && canvasRef.current && isCameraReady) {
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
        onCapture(canvas.toDataURL('image/jpeg', 0.8));
      }
    }
  }, [facingMode, onCapture, timeLabel, dateLabel, dayLabel, locationLabel, gpsCode, studentName, shiftLabel, selectedKelas, keteranganLabel, isCameraReady]);

  const handleCaptureClick = () => {
    if (!isCameraReady || countdown !== null) return;
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
    <div className="fixed inset-0 z-[100] bg-black flex flex-col overflow-hidden animate-in fade-in duration-300">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted
        webkit-playsinline="true"
        onCanPlay={handleVideoCanPlay}
        className={`w-full h-full object-cover transition-opacity duration-700 ${isCameraReady ? 'opacity-100' : 'opacity-0'} ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} 
      />
      
      {!isCameraReady && !cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-[110]">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6"></div>
          <p className="text-white font-black text-[10px] uppercase tracking-[0.3em] animate-pulse mb-2">{loadingStatus}</p>
          
          {showForceButton && (
            <button 
              onClick={(e) => { e.stopPropagation(); forcePlay(); }}
              className="mt-12 px-8 py-4 bg-white text-indigo-600 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-2xl active:scale-95 transition-transform"
            >
              PAKSA AKTIFKAN KAMERA
            </button>
          )}
        </div>
      )}

      {cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 px-10 text-center z-[120]">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-white font-black text-lg mb-2 uppercase tracking-tighter">KAMERA TIDAK AKTIF</h3>
          <p className="text-white/50 text-xs mb-8 leading-relaxed">{cameraError}</p>
          <button onClick={(e) => { e.stopPropagation(); startCamera(); }} className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95">COBA LAGI SEKARANG</button>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="mt-6 text-white/30 text-[10px] font-bold uppercase tracking-widest py-2">BATALKAN</button>
        </div>
      )}
      
      {countdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-[130]">
          <span className="text-white text-[12rem] font-black animate-[ping_1s_infinite] drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]">
            {countdown}
          </span>
        </div>
      )}
      
      <div className="absolute top-10 left-8 right-8 flex justify-between items-start z-[140]">
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-4 glass-morphism rounded-full text-white active:scale-90 transition-transform">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="text-right">
          <div className="flex items-center justify-end space-x-2">
            <div className={`w-2 h-2 ${isCameraReady ? 'bg-cyan-400' : 'bg-red-500'} rounded-full animate-pulse`}></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white">LIVE_SYSTEM</p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-12 left-0 right-0 flex justify-between items-center px-12 z-[140]">
        <button 
          onClick={(e) => { e.stopPropagation(); setFacingMode(f => f === 'user' ? 'environment' : 'user'); }} 
          disabled={!isCameraReady}
          className="w-14 h-14 glass-morphism rounded-full text-white flex items-center justify-center active:scale-90 transition-all disabled:opacity-10"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path>
          </svg>
        </button>
        
        <button
          onClick={(e) => { e.stopPropagation(); handleCaptureClick(); }}
          disabled={!isCameraReady}
          className={`w-24 h-24 bg-white rounded-full flex items-center justify-center p-1.5 shadow-[0_0_50px_rgba(255,255,255,0.4)] active:scale-95 transition-transform ${!isCameraReady ? 'opacity-10' : ''}`}
        >
          <div className="w-full h-full border-[6px] border-slate-100 rounded-full bg-white flex items-center justify-center">
            {countdown ? (
               <span className="text-slate-900 font-black text-2xl mono">{countdown}</span>
            ) : (
               <div className="w-1/2 h-1/2 bg-indigo-600 rounded-full"></div>
            )}
          </div>
        </button>

        <button 
          onClick={(e) => { e.stopPropagation(); setTimerDuration(t => t === 0 ? 3 : t === 3 ? 5 : 0); }}
          disabled={!isCameraReady}
          className={`w-14 h-14 glass-morphism rounded-full flex flex-col items-center justify-center active:scale-90 transition-all border disabled:opacity-10 ${timerDuration > 0 ? 'border-yellow-400 text-yellow-400' : 'border-white/10 text-white'}`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path>
          </svg>
          {timerDuration > 0 && <span className="absolute -top-1 -right-1 bg-yellow-400 text-black text-[8px] font-black px-1 rounded">{timerDuration}s</span>}
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default CameraCapture;
